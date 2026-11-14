// fixture creates disposable local test material, never deployment certificates.
package main

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/hex"
	"encoding/pem"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"time"
)

func main() {
	if len(os.Args) != 2 {
		panic("fixture output directory required")
	}
	dir := os.Args[1]
	if err := os.MkdirAll(dir, 0700); err != nil {
		panic("fixture directory")
	}
	write := func(name string, b []byte) {
		if os.WriteFile(filepath.Join(dir, name), b, 0644) != nil {
			panic("fixture write failed")
		}
	}
	secret := func() string { b := make([]byte, 32); rand.Read(b); return hex.EncodeToString(b) }
	caKey, _ := rsa.GenerateKey(rand.Reader, 2048)
	serverKey, _ := rsa.GenerateKey(rand.Reader, 2048)
	now := time.Now()
	ca := &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "Disposable IDF test CA"}, NotBefore: now.Add(-time.Hour), NotAfter: now.Add(24 * time.Hour), IsCA: true, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageCertSign}
	caDER, err := x509.CreateCertificate(rand.Reader, ca, ca, &caKey.PublicKey, caKey)
	if err != nil {
		panic("fixture CA")
	}
	cert := &x509.Certificate{SerialNumber: big.NewInt(2), Subject: pkix.Name{CommonName: "mysql"}, DNSNames: []string{"mysql"}, NotBefore: now.Add(-time.Hour), NotAfter: now.Add(24 * time.Hour), KeyUsage: x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth}}
	certDER, err := x509.CreateCertificate(rand.Reader, cert, ca, &serverKey.PublicKey, caKey)
	if err != nil {
		panic("fixture certificate")
	}
	write("ca.pem", pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: caDER}))
	write("server.pem", pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: certDER}))
	write("server.key", pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(serverKey)}))
	// Separate HTTPS key/certificate, trusted only by this disposable test client.
	httpsKey, _ := rsa.GenerateKey(rand.Reader, 2048)
	https := &x509.Certificate{SerialNumber: big.NewInt(3), DNSNames: []string{"campus.test"}, NotBefore: now.Add(-time.Hour), NotAfter: now.Add(24 * time.Hour), KeyUsage: x509.KeyUsageDigitalSignature, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth}}
	httpsDER, err := x509.CreateCertificate(rand.Reader, https, ca, &httpsKey.PublicKey, caKey)
	if err != nil {
		panic("fixture HTTPS certificate")
	}
	write("https.pem", pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: httpsDER}))
	write("https.key", pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(httpsKey)}))
	root, app, migration := secret(), secret(), secret()
	write("root-password", []byte(root))
	write("backup-client.cnf", []byte("[client]\nuser=root\npassword="+root+"\nprotocol=SOCKET\n"))
	sql := fmt.Sprintf("CREATE USER 'idf_app'@'%%' IDENTIFIED BY '%s' REQUIRE SSL;\nCREATE USER 'idf_migration'@'%%' IDENTIFIED BY '%s' REQUIRE SSL;\n", app, migration)
	for i := 0; i < 65; i++ {
		db := fmt.Sprintf("idf_test_%d", i)
		sql += fmt.Sprintf("CREATE DATABASE %s CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;\nGRANT SELECT,INSERT,UPDATE,DELETE ON %s.* TO 'idf_app'@'%%';\nGRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,DROP,INDEX,REFERENCES ON %s.* TO 'idf_migration'@'%%';\n", db, db, db)
	}
	write("initialize.sql", []byte(sql))
	write("test.env", []byte(fmt.Sprintf("MYSQL_DSN=idf_app:%s@tcp(mysql:3306)/idf_test_0?tls=true\nMYSQL_MIGRATION_DSN=idf_migration:%s@tcp(mysql:3306)/idf_test_0?tls=true&multiStatements=true\nMYSQL_CA_FILE=/fixtures/ca.pem\n", app, migration)))
	fmt.Println("Disposable credentials and CA generated; values omitted")
}
