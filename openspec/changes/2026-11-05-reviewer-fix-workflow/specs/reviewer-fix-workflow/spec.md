## Purpose

定义CampusClawPlus审查者直接修复并完成合并的协作方式，减少作者与审查者之间仅为落实意见而发生的往返。所有修复仍须在原分支保护同伴工作，留下实际操作者、最终版本、必要验证与共享进度；未决公共契约、远端强制条件及真实验收不能被流程简化掩盖。

## ADDED Requirements

### Requirement: RFW-01 Reviewer owns repairs and closure
审查者 SHALL 直接完成已明确范围内的修复、验证、提交和合并，不因参与修复而强制由原作者反向再审。

#### Scenario: RFW-SC-01 Repair in the existing PR
- **WHEN** 审查者发现能依据既有规约确定的问题
- **THEN** 直接在原PR分支修复并同步共享表，保留同伴修改，记录最终head与结果后按条件收口

#### Scenario: RFW-SC-02 Unresolved public decisions
- **WHEN** 修复依赖尚未明确的公共契约或范围选择
- **THEN** 先明确规约和单源合同再实施，不将待定写成批准，也不将planned接口提前接线

### Requirement: RFW-02 Preserve attributable review and merge gates
仓库协作 SHALL 保留实际操作者与验证证据，满足远端强制条件和对应G2/G3依赖后才正常合并。

#### Scenario: RFW-SC-03 No fabricated approval
- **WHEN** 审查者亲自修复或组长承接现有审查意见
- **THEN** 使用自己身份记录修复和最终结论，不声称其他成员批准新head；不因修复增加内部反向审批，但远端要求的审核仍须满足

#### Scenario: RFW-SC-04 Failures block merge
- **WHEN** 最终head检查失败、存在冲突、业务依赖未满足或远端强制条件未满足
- **THEN** 保留真实阻塞并修复，不跳过检查、伪造结果或使用管理员绕过

#### Scenario: RFW-SC-05 Shared status follows actual outcomes
- **WHEN** 修复形成提交或PR完成合并
- **THEN** 同步共享表的改动/验证/下一步；实际合并后再记录main SHA，规约合并不冒充实现和归档完成
