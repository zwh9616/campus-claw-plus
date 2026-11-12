//go:build integration

package wiring

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/cookiejar"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/zwh9616/campus-claw-plus/backend/internal/assignments"
)

// AT-SC-01..08/21: real default artifacts behind Nginx, trusted TLS and MySQL.
// No worker is bound: retained acceptance must remain genuinely pending.
func verifyATWiring(t *testing.T, client *http.Client, teacher string, secrets *[]string) {
	t.Helper()
	const key = "wiring_submit_0001"
	const answer = "HTTPS提交😀\n原答案"
	*secrets = append(*secrets, key, answer)
	request := func(c *http.Client, method, path, access, body string, want int) []byte {
		t.Helper()
		r, _ := http.NewRequest(method, "https://campus.test"+path, strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("Origin", "https://campus.test")
		r.Header.Set("Authorization", "Bearer "+access)
		if strings.HasSuffix(path, "/submissions") && method == "POST" {
			r.Header.Set("Idempotency-Key", key)
		}
		res, e := c.Do(r)
		if e != nil {
			t.Fatal("AT trusted HTTPS transport")
		}
		defer res.Body.Close()
		b, e := io.ReadAll(io.LimitReader(res.Body, 65537))
		if e != nil || res.StatusCode != want {
			t.Fatalf("AT %s %s status=%d want=%d", method, path, res.StatusCode, want)
		}
		if res.Header.Get("Cache-Control") != "no-store" || len(res.Header.Get("X-Request-ID")) != 32 {
			t.Fatal("AT no-store/request id")
		}
		var auth struct {
			Access string `json:"access_token"`
			CSRF   string `json:"csrf_token"`
		}
		json.Unmarshal(b, &auth)
		for _, value := range []string{auth.Access, auth.CSRF} {
			if value != "" {
				*secrets = append(*secrets, value)
			}
		}
		for _, cookie := range res.Cookies() {
			*secrets = append(*secrets, cookie.Value)
		}
		return b
	}
	seed, e := os.ReadFile("/fixtures/seed.json")
	var input struct {
		Users []struct {
			Username string `json:"username"`
			Password string `json:"password"`
		} `json:"users"`
	}
	if e != nil || json.Unmarshal(seed, &input) != nil || len(input.Users) != 5 {
		t.Fatal("AT trusted seed")
	}
	login := func(index int) (*http.Client, string) {
		t.Helper()
		jar, _ := cookiejar.New(nil)
		c := &http.Client{Timeout: client.Timeout, Transport: client.Transport, Jar: jar}
		body, _ := json.Marshal(input.Users[index])
		b := request(c, "POST", "/api/v1/auth/login", "", string(body), 200)
		var auth struct {
			Access string `json:"access_token"`
		}
		if json.Unmarshal(b, &auth) != nil || auth.Access == "" {
			t.Fatal("AT trusted login")
		}
		return c, auth.Access
	}
	persist := os.Getenv("WIRING_EXPECT") == "persist"
	// Preserve real access sessions in this disposable private fixture. Repeated
	// logins during the DB-restart phase would consume the unchanged source-IP
	// login quota. Reusing the session also proves that it survives recreation.
	const accessPath = "/fixtures/assignment-access"
	var accesses []string
	if persist {
		raw, e := os.ReadFile(accessPath)
		if e != nil || json.Unmarshal(raw, &accesses) != nil || len(accesses) != 3 {
			t.Fatal("AT retained real sessions")
		}
	} else {
		for _, index := range []int{1, 2, 4} {
			_, access := login(index)
			accesses = append(accesses, access)
		}
		raw, _ := json.Marshal(accesses)
		if os.WriteFile(accessPath, raw, 0600) != nil {
			t.Fatal("AT private real-session fixture")
		}
	}
	*secrets = append(*secrets, accesses...)
	student, other, foreign := accesses[0], accesses[1], accesses[2]
	studentClient, otherClient, foreignClient := client, client, client
	var proof struct {
		AssignmentID string
		Accepted     assignments.Accepted
	}
	const proofPath = "/fixtures/assignment-proof"
	if persist {
		b, e := os.ReadFile(proofPath)
		if e != nil || json.Unmarshal(b, &proof) != nil || proof.AssignmentID == "" {
			t.Fatal("AT retained assignment proof")
		}
	} else {
		body, _ := json.Marshal(assignments.CreateInput{Title: "HTTPS真实作业", Description: "受理与执行分列", Deadline: time.Now().UTC().Add(24 * time.Hour).Format(assignments.Timestamp)})
		b := request(client, "POST", "/api/v1/assignments", teacher, string(body), 201)
		var a assignments.Assignment
		if json.Unmarshal(b, &a) != nil || a.ID == "" || a.Version != 1 {
			t.Fatal("AT actual create")
		}
		proof.AssignmentID = a.ID
	}
	path := "/api/v1/assignments/" + proof.AssignmentID
	request(studentClient, "POST", "/api/v1/assignments", student, `{}`, 403)
	request(foreignClient, "GET", path, foreign, "", 404)
	body, _ := json.Marshal(map[string]any{"answer": answer, "assignment_version": 1})
	b := request(studentClient, "POST", path+"/submissions", student, string(body), 202)
	var accepted assignments.Accepted
	if json.Unmarshal(b, &accepted) != nil || accepted.SubmissionID == "" || accepted.TaskID == "" || accepted.Status != "pending" {
		t.Fatal("AT actual atomic acceptance")
	}
	if persist && accepted != proof.Accepted {
		t.Fatal("AT replay changed durable 202 across recreation")
	}
	proof.Accepted = accepted
	if !persist {
		raw, _ := json.Marshal(proof)
		if os.WriteFile(proofPath, raw, 0644) != nil {
			t.Fatal("AT write resource proof")
		}
	}
	// Equivalent JSON representation must replay the original pending snapshot.
	b = request(studentClient, "POST", path+"/submissions", student, `{"assignment_version":1.0,"answer":"HTTPS提交\ud83d\ude00\n原答案"}`, 202)
	var replay assignments.Accepted
	if json.Unmarshal(b, &replay) != nil || replay != accepted {
		t.Fatal("AT canonical payload replay")
	}
	subPath := "/api/v1/submissions/" + accepted.SubmissionID
	b = request(studentClient, "GET", subPath, student, "", 200)
	var submission assignments.Submission
	if json.Unmarshal(b, &submission) != nil || submission.Answer != answer || submission.TaskID != accepted.TaskID {
		t.Fatal("AT retained exact answer")
	}
	request(otherClient, "GET", subPath, other, "", 404)
	request(foreignClient, "GET", subPath, foreign, "", 404)
	taskPath := "/api/v1/tasks/" + accepted.TaskID
	for _, actor := range []struct {
		Client *http.Client
		Access string
	}{{client, teacher}, {studentClient, student}} {
		b = request(actor.Client, "GET", taskPath, actor.Access, "", 200)
		var task assignments.Task
		if json.Unmarshal(b, &task) != nil || task.Status != "pending" || task.Attempt != 0 || task.Epoch != 0 || task.Version != 1 || task.CancelRequested || task.Error != nil {
			t.Fatal("AT unbound executor fabricated progress")
		}
	}
	request(otherClient, "GET", taskPath, other, "", 404)
	request(foreignClient, "GET", taskPath, foreign, "", 404)
	request(client, "POST", taskPath+"/cancel", teacher, `{"version":1}`, 403)
	request(studentClient, "POST", path+"/submissions", student, `{"answer":"x","assignment_version":1,"student_id":"1"}`, 400)
	if bytes.Contains(b, []byte(answer)) {
		t.Fatal("AT task snapshot leaks answer")
	}
	t.Log("AT-SC-01..08/21 default HTTPS authorization, durable 202 and genuine pending persistence passed; worker not implemented")
}
