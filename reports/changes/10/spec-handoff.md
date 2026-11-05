> 本文保留历史交接；当前收口、规则和验证见 [集成修复记录](integration-fix-2026-11-05.md)，旧的往返审查和状态不再作为当前指令。

# 10规约交小陈审查

变更：2026-11-05-delivery-observability；规约/终审小葛，审规约/实现小陈（GitHub Kevcco）。本次由gjj6666授权AI辅助起草，仅规约与证据/进度；起草基线main 2bf12e2，未apply，未合并。

## 请审当前head

1. A范围是否能先独立交付：保留00加入后的全部npm检查，make只封装；各项失败、安装/取消/超时真实非零，CI不跳文档PR。
2. main当前protected=false；D3要求实际保护、来源正确的required check及非作者批准，旧head批准失效；管理员无权限/套餐问题是阻塞，不能口头代替。受控红CI还要有有效保护及合并被阻断证据，禁止真合并坏版本做实验。
3. G2+本规约批准后才能A apply；A终审、main集成复验后才G3。B逐服务及C真实观测/恢复保持后续，不要求今天一口气实现完整部署系统。
4. D4接口/健康变更必须先收口00合同；D5阈值/无数据/有界标签与告警投递，D6隔离备份恢复、迁移兼容和RPO/RTO是否可验；新增业务路由不在10里猜。
5. 20个DO场景与tasks均有验收办法，未做项未勾选；发现歧义请给文件/段落、原因、建议、可验条件，由小葛修规约后你复审，不代你批准。

## 自检实绩

- OpenSpec1.13.0：本change严格1 passed/0 failed，全量2 passed/0 failed，原始输出[spec-validation.json](spec-validation.json)。4/4表示产物齐全，不表示小陈批准或准入满足。
- foundation及git diff --check退出0；全历史13个提交及本次暂存秘密扫描退出0，无泄漏。
- 本PR没有实现/配置/锁文件变更，未声称10的npm gate、Make、CI保护、红绿或恢复已经运行；这些都是待小陈实现并由小葛终审的任务。
- 另含小葛对00当前75cadbf的独立复测和[正式终审](https://github.com/zwh9616/campus-claw-plus/pull/5#pullrequestreview-5782045346)，它不是10的A门禁证据。本机完整check因Docker未运行退出1，环境限制如实记录；远端00 CI成功独立列出。

## 交接顺序

请小陈先审本规约；小张负责00新会话/main集成及01审查，并交02规约。小葛收到02后优先首个可用20分钟审查，不提前apply；03保留后续。当前G2/G3均未成立。共享表继承PR #5未合入版本；合并前逐行与其他活动PR核对，不覆盖他人进度。

正式交接：[PR #7](https://github.com/zwh9616/campus-claw-plus/pull/7)，GitHub requested_reviewers 已选择 Kevcco。初始规约提交 f1052f07416e93237e1a16e0ba7b8d1961f6411a；本提交只补真实PR/请求状态，最终审查须绑定最新head。CI结果按远端当前运行查询，不沿用00的成功。

CI历史：7a14db7的check/audit通过，secret-scan因官方工具下载失败退出1、verify未执行，见[实际失败记录](ci-download-failure.md)。本提交仅保留事实，由原CI重新运行；不改脚本或降低检查。
