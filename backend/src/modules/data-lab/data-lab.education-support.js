function buildEducationTemplate(builders) {
  const {
    relation,
    dictTable,
    pkField,
    fkField,
    varcharField,
    datetimeField,
    intField,
    decimalField,
    codeField,
    addAuditFields,
    addRegionFields,
  } = builders;
  const optionalDateTime = (fieldName, fieldComment) => ({
    ...datetimeField(fieldName, fieldComment),
    nullable: true,
    validationRule: "",
  });

  return {
    tables: [
      {
        tableName: "campus_dimension",
        tableComment: "校园维表",
        businessRole: "MASTER",
        generationPriority: 1,
        fields: [
          pkField("campus_id", "BIGINT", "校园主键"),
          codeField("campus_code", "校园编码", "TEXT", true),
          varcharField("campus_name", 128, "校园名称", "TEXT", false),
          codeField("school_code", "学校编码", "TEXT", true),
          varcharField("school_name", 128, "学校名称", "TEXT", false),
          varcharField("school_type", 32, "学校类型", "DICT_STATUS", false),
          varcharField("education_stage", 32, "教育阶段", "DICT_STAGE", false),
          ...addRegionFields(),
          varcharField("campus_address", 255, "校园地址", "TEXT"),
          varcharField("postal_code", 16, "邮编", "TEXT"),
          varcharField("office_phone", 16, "办公联系人手机号", "PHONE"),
          varcharField("principal_name", 64, "校长姓名", "PERSON_NAME"),
          varcharField("principal_mobile", 16, "校长手机号", "PHONE"),
          varcharField("support_hotline", 16, "校园服务手机号", "PHONE"),
          intField("capacity_count", "办学容量"),
          varcharField("campus_status", 32, "校园状态", "DICT_STATUS"),
          datetimeField("established_at", "建校时间"),
          codeField("campus_card_prefix", "门禁卡前缀"),
          codeField("library_card_prefix", "图书证前缀"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "student_profile",
        tableComment: "学生档案表",
        businessRole: "MASTER",
        generationPriority: 2,
        fields: [
          pkField("student_id", "BIGINT", "学生主键"),
          fkField("campus_id", "BIGINT", "校园主键", "campus_dimension", "campus_id"),
          codeField("student_no", "学籍号", "ORDER_NO", true),
          varcharField("student_name", 64, "学生姓名", "PERSON_NAME", false),
          varcharField("gender", 16, "性别", "TEXT"),
          datetimeField("birth_date", "出生日期"),
          varcharField("id_card_no", 18, "身份证号", "ID_CARD", false, true),
          varcharField("student_mobile", 16, "学生手机号", "PHONE"),
          varcharField("student_email", 128, "学生邮箱", "EMAIL"),
          varcharField("education_stage", 32, "教育阶段", "DICT_STAGE", false),
          varcharField("grade_code", 32, "年级编码", "DICT_STAGE", false),
          varcharField("class_code", 32, "班级编码", "TEXT", false),
          varcharField("class_name", 64, "班级名称", "TEXT"),
          intField("entrance_year", "入学年份"),
          intField("expected_graduation_year", "预计毕业年份"),
          varcharField("student_status", 32, "学生状态", "DICT_STATUS"),
          codeField("access_card_no", "门禁卡号", "TEXT", true),
          codeField("library_card_no", "图书证号", "TEXT", true),
          varcharField("guardian_name", 64, "监护人姓名", "PERSON_NAME"),
          varcharField("guardian_mobile", 16, "监护人手机号", "PHONE"),
          ...addRegionFields(),
          varcharField("home_address", 255, "家庭住址", "TEXT"),
          varcharField("postal_code", 16, "邮编", "TEXT"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "guardian_contact",
        tableComment: "监护人联系表",
        businessRole: "DETAIL",
        generationPriority: 3,
        fields: [
          pkField("guardian_id", "BIGINT", "监护人主键"),
          fkField("student_id", "BIGINT", "学生主键", "student_profile", "student_id"),
          codeField("guardian_no", "监护人编号", "TEXT", true),
          varcharField("guardian_name", 64, "监护人姓名", "PERSON_NAME", false),
          varcharField("relation_type", 32, "关系类型", "DICT_STATUS", false),
          varcharField("guardian_mobile", 16, "监护人手机号", "PHONE", false),
          varcharField("guardian_email", 128, "监护人邮箱", "EMAIL"),
          varcharField("emergency_phone", 16, "紧急联系人手机号", "PHONE"),
          varcharField("occupation_name", 64, "职业名称", "TEXT"),
          varcharField("company_name", 128, "工作单位", "TEXT"),
          ...addRegionFields(),
          varcharField("address_detail", 255, "详细地址", "TEXT"),
          intField("primary_flag", "主联系人标记"),
          varcharField("message_channel", 32, "通知渠道", "DICT_CHANNEL"),
          datetimeField("last_contact_time", "最近联系时间"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "staff_profile",
        tableComment: "教职工档案表",
        businessRole: "MASTER",
        generationPriority: 4,
        fields: [
          pkField("staff_id", "BIGINT", "教职工主键"),
          fkField("campus_id", "BIGINT", "校园主键", "campus_dimension", "campus_id"),
          codeField("staff_no", "工号", "ORDER_NO", true),
          varcharField("staff_name", 64, "姓名", "PERSON_NAME", false),
          varcharField("gender", 16, "性别", "TEXT"),
          varcharField("id_card_no", 18, "身份证号", "ID_CARD", false, true),
          varcharField("staff_mobile", 16, "手机号", "PHONE", false),
          varcharField("staff_email", 128, "邮箱", "EMAIL"),
          varcharField("role_code", 32, "岗位编码", "DICT_STATUS", false),
          varcharField("subject_code", 32, "学科编码", "DICT_STATUS"),
          varcharField("title_name", 64, "职称", "TEXT"),
          varcharField("department_name", 128, "部门名称", "TEXT"),
          datetimeField("hire_date", "入职日期"),
          varcharField("employment_status", 32, "在职状态", "DICT_STATUS"),
          codeField("teacher_license_no", "教师资格证号"),
          codeField("access_card_no", "门禁卡号", "TEXT", true),
          varcharField("office_location", 128, "办公地点", "TEXT"),
          ...addRegionFields(),
          varcharField("home_address", 255, "居住地址", "TEXT"),
          varcharField("postal_code", 16, "邮编", "TEXT"),
          varcharField("supervisor_name", 64, "上级主管", "PERSON_NAME"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "course_catalog",
        tableComment: "课程目录表",
        businessRole: "MASTER",
        generationPriority: 5,
        fields: [
          pkField("course_id", "BIGINT", "课程主键"),
          fkField("campus_id", "BIGINT", "校园主键", "campus_dimension", "campus_id"),
          codeField("course_code", "课程编码", "ORDER_NO", true),
          varcharField("course_name", 128, "课程名称", "TEXT", false),
          varcharField("subject_code", 32, "学科编码", "DICT_STATUS", false),
          varcharField("education_stage", 32, "教育阶段", "DICT_STAGE", false),
          varcharField("grade_code", 32, "年级编码", "DICT_STAGE", false),
          varcharField("term_code", 32, "学期编码", "DICT_STATUS", false),
          decimalField("credit_value", "学分", "NUMBER"),
          intField("total_periods", "总课时"),
          intField("weekly_periods", "周课时"),
          varcharField("course_type", 32, "课程类型", "DICT_STATUS"),
          varcharField("assessment_type", 32, "考核方式", "DICT_STATUS"),
          varcharField("textbook_version", 64, "教材版本", "TEXT"),
          intField("lead_teacher_id", "负责人教师ID"),
          varcharField("teacher_name", 64, "负责人教师", "PERSON_NAME"),
          varcharField("classroom_type", 32, "教室类型", "DICT_STATUS"),
          intField("enrollment_limit", "选课上限"),
          varcharField("course_status", 32, "课程状态", "DICT_STATUS"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "class_schedule",
        tableComment: "排课明细表",
        businessRole: "FLOW",
        generationPriority: 6,
        fields: [
          pkField("schedule_id", "BIGINT", "排课主键"),
          fkField("course_id", "BIGINT", "课程主键", "course_catalog", "course_id"),
          fkField("staff_id", "BIGINT", "教师主键", "staff_profile", "staff_id"),
          fkField("campus_id", "BIGINT", "校园主键", "campus_dimension", "campus_id"),
          codeField("schedule_no", "排课编号", "ORDER_NO", true),
          varcharField("term_code", 32, "学期编码", "DICT_STATUS", false),
          varcharField("grade_code", 32, "年级编码", "DICT_STAGE", false),
          varcharField("class_code", 32, "班级编码", "TEXT", false),
          varcharField("class_name", 64, "班级名称", "TEXT"),
          intField("week_no", "教学周"),
          intField("weekday_no", "星期"),
          intField("section_start", "开始节次"),
          intField("section_end", "结束节次"),
          datetimeField("start_time", "开始时间"),
          datetimeField("end_time", "结束时间"),
          codeField("classroom_code", "教室编码"),
          varcharField("classroom_name", 128, "教室名称", "TEXT"),
          varcharField("teaching_mode", 32, "授课方式", "DICT_STATUS"),
          intField("attendance_required", "考勤要求"),
          varcharField("schedule_status", 32, "排课状态", "DICT_STATUS"),
          varcharField("generated_by", 64, "生成来源", "TEXT"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "student_enrollment",
        tableComment: "学籍注册表",
        businessRole: "DETAIL",
        generationPriority: 7,
        fields: [
          pkField("enrollment_id", "BIGINT", "学籍注册主键"),
          fkField("student_id", "BIGINT", "学生主键", "student_profile", "student_id"),
          fkField("campus_id", "BIGINT", "校园主键", "campus_dimension", "campus_id"),
          codeField("enrollment_no", "学籍注册编号", "ORDER_NO", true),
          varcharField("academic_year", 32, "学年", "TEXT", false),
          varcharField("term_code", 32, "学期编码", "DICT_STATUS", false),
          varcharField("education_stage", 32, "教育阶段", "DICT_STAGE"),
          varcharField("grade_code", 32, "年级编码", "DICT_STAGE"),
          varcharField("class_code", 32, "班级编码", "TEXT"),
          varcharField("class_name", 64, "班级名称", "TEXT"),
          intField("entrance_year", "入学年份"),
          intField("counselor_id", "辅导员ID"),
          varcharField("counselor_name", 64, "辅导员姓名", "PERSON_NAME"),
          varcharField("registration_status", 32, "注册状态", "DICT_STATUS"),
          varcharField("dormitory_no", 32, "宿舍号", "TEXT"),
          varcharField("bed_no", 16, "床位号", "TEXT"),
          intField("scholarship_flag", "奖学金标记"),
          decimalField("subsidy_amount", "助学金额"),
          datetimeField("enrollment_date", "入学日期"),
          datetimeField("report_date", "报到日期"),
          datetimeField("graduation_date", "毕业日期"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "tuition_bill",
        tableComment: "学费账单表",
        businessRole: "FLOW",
        generationPriority: 8,
        fields: [
          pkField("bill_id", "BIGINT", "账单主键"),
          fkField("student_id", "BIGINT", "学生主键", "student_profile", "student_id"),
          fkField("campus_id", "BIGINT", "校园主键", "campus_dimension", "campus_id"),
          codeField("bill_no", "账单编号", "ORDER_NO", true),
          varcharField("term_code", 32, "学期编码", "DICT_STATUS", false),
          varcharField("academic_year", 32, "学年", "TEXT", false),
          varcharField("fee_category", 32, "费用类别", "DICT_STATUS", false),
          decimalField("receivable_amount", "应收金额"),
          decimalField("discount_amount", "减免金额"),
          decimalField("paid_amount", "实收金额"),
          decimalField("arrears_amount", "欠费金额"),
          varcharField("bill_status", 32, "账单状态", "DICT_STATUS", false),
          varcharField("pay_channel", 32, "支付渠道", "DICT_CHANNEL"),
          varcharField("collector_name", 64, "收费员", "PERSON_NAME"),
          codeField("invoice_no", "发票号", "TEXT", true),
          datetimeField("due_time", "应缴时间"),
          optionalDateTime("pay_time", "缴费时间"),
          optionalDateTime("refund_time", "退款时间"),
          varcharField("payer_name", 64, "付款人", "PERSON_NAME"),
          varcharField("payer_mobile", 16, "付款人手机号", "PHONE"),
          codeField("campus_account_no", "校园收款账号"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "campus_access_log",
        tableComment: "校园门禁记录表",
        businessRole: "LOG",
        generationPriority: 9,
        fields: [
          pkField("access_id", "BIGINT", "门禁记录主键"),
          fkField("campus_id", "BIGINT", "校园主键", "campus_dimension", "campus_id"),
          codeField("access_no", "门禁记录编号", "ORDER_NO", true),
          varcharField("holder_type", 32, "持卡人类型", "DICT_STATUS", false),
          intField("holder_id", "持卡人ID"),
          codeField("card_no", "卡号", "TEXT", true),
          varcharField("holder_name", 64, "持卡人姓名", "PERSON_NAME"),
          varcharField("holder_mobile", 16, "持卡人手机号", "PHONE"),
          codeField("gate_code", "门岗编码"),
          varcharField("gate_name", 128, "门岗名称", "TEXT"),
          varcharField("access_result", 32, "通行结果", "DICT_STATUS"),
          codeField("device_code", "设备编码"),
          datetimeField("entry_time", "入校时间"),
          optionalDateTime("exit_time", "离校时间"),
          intField("stay_minutes", "停留分钟数"),
          intField("alarm_flag", "告警标记"),
          varcharField("duty_officer", 64, "值班人员", "PERSON_NAME"),
          varcharField("remark", 255, "备注", "TEXT"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "library_borrow_record",
        tableComment: "图书借阅记录表",
        businessRole: "FLOW",
        generationPriority: 10,
        fields: [
          pkField("borrow_id", "BIGINT", "借阅主键"),
          fkField("campus_id", "BIGINT", "校园主键", "campus_dimension", "campus_id"),
          varcharField("borrower_type", 32, "借阅人类型", "DICT_STATUS", false),
          intField("borrower_id", "借阅人ID"),
          varcharField("borrower_name", 64, "借阅人姓名", "PERSON_NAME"),
          codeField("card_no", "图书证号", "TEXT"),
          codeField("borrow_no", "借阅编号", "ORDER_NO", true),
          codeField("isbn_code", "ISBN编码"),
          codeField("book_code", "图书编码"),
          varcharField("book_name", 128, "图书名称", "TEXT"),
          varcharField("category_code", 32, "分类编码", "DICT_STATUS"),
          varcharField("author_name", 64, "作者", "PERSON_NAME"),
          varcharField("publisher_name", 128, "出版社", "TEXT"),
          datetimeField("borrow_time", "借出时间"),
          datetimeField("due_time", "应还时间"),
          optionalDateTime("return_time", "归还时间"),
          varcharField("borrow_status", 32, "借阅状态", "DICT_STATUS"),
          intField("renew_count", "续借次数"),
          intField("overdue_days", "逾期天数"),
          decimalField("fine_amount", "罚金金额"),
          varcharField("operator_name", 64, "办理人", "PERSON_NAME"),
          codeField("shelf_code", "书架编码"),
          ...addAuditFields(),
        ],
      },
    ],
    dictTables: [
      dictTable("school_type_dict", "学校类型字典", [["PUBLIC_PRIMARY", "公办小学"], ["PUBLIC_JUNIOR", "公办初中"], ["PUBLIC_HIGH", "公办高中"], ["PRIVATE_K12", "民办K12"], ["VOCATIONAL_COLLEGE", "职业院校"], ["PUBLIC_UNIVERSITY", "公办高校"]]),
      dictTable("education_stage_dict", "教育阶段字典", [["PRIMARY", "小学"], ["JUNIOR", "初中"], ["HIGH", "高中"], ["VOCATIONAL", "中职"], ["UNDERGRAD", "本科"], ["POSTGRAD", "研究生"]]),
      dictTable("grade_dict", "年级字典", [["P1", "小学一年级"], ["P6", "小学六年级"], ["J1", "初一"], ["J3", "初三"], ["H1", "高一"], ["H3", "高三"], ["UG1", "大一"], ["UG4", "大四"], ["PG1", "研一"], ["PG2", "研二"]]),
      dictTable("subject_dict", "学科字典", [["CHINESE", "语文"], ["MATH", "数学"], ["ENGLISH", "英语"], ["PHYSICS", "物理"], ["CHEMISTRY", "化学"], ["BIOLOGY", "生物"], ["COMPUTER", "计算机"], ["PE", "体育"]]),
      dictTable("staff_role_dict", "岗位字典", [["HEADMASTER", "校长"], ["TEACHER", "教师"], ["COUNSELOR", "辅导员"], ["ACADEMIC_AFFAIRS", "教务"], ["FINANCE", "财务"], ["LIBRARIAN", "图书管理员"], ["SECURITY", "保卫"], ["LOGISTICS", "后勤"]]),
      dictTable("bill_status_dict", "账单状态字典", [["PENDING", "待缴费"], ["PARTIAL", "部分缴费"], ["PAID", "已缴费"], ["OVERDUE", "已逾期"], ["REFUNDED", "已退款"]]),
      dictTable("access_result_dict", "门禁结果字典", [["PASS", "放行"], ["LATE", "迟到"], ["DENY", "拒绝通行"], ["MANUAL_RELEASE", "人工放行"]]),
      dictTable("borrow_status_dict", "借阅状态字典", [["BORROWING", "借阅中"], ["RETURNED", "已归还"], ["OVERDUE", "已逾期"]]),
    ],
    relations: [
      relation("campus_dimension", "campus_id", "student_profile", "campus_id", "1:N"),
      relation("student_profile", "student_id", "guardian_contact", "student_id", "1:N"),
      relation("campus_dimension", "campus_id", "staff_profile", "campus_id", "1:N"),
      relation("campus_dimension", "campus_id", "course_catalog", "campus_id", "1:N"),
      relation("course_catalog", "course_id", "class_schedule", "course_id", "1:N"),
      relation("student_profile", "student_id", "student_enrollment", "student_id", "1:N"),
      relation("student_profile", "student_id", "tuition_bill", "student_id", "1:N"),
      relation("campus_dimension", "campus_id", "campus_access_log", "campus_id", "1:N"),
      relation("campus_dimension", "campus_id", "library_borrow_record", "campus_id", "1:N"),
    ],
    modelExplanation: "教育行业增强模板覆盖校园、学生、监护人、教职工、课程、排课、学籍、收费、门禁和图书借阅核心链路。",
  };
}

function buildEducationDirtyPlans(row, table, startedAt) {
  const tableName = String(table?.tableName || "");
  const parseTime = (fieldName) => {
    const time = new Date(String(row[fieldName] || startedAt)).getTime();
    return Number.isNaN(time) ? null : time;
  };
  const plans = [];
  if (tableName === "student_profile") {
    plans.push({ category: "CONSISTENCY", rule: "EDU_GRAD_YEAR_BEFORE_ENTRANCE", fieldName: "expected_graduation_year", apply: () => { row.expected_graduation_year = Number(row.entrance_year || 2026) - 1; } });
  }
  if (tableName === "class_schedule") {
    plans.push({ category: "TIMELINESS", rule: "EDU_SCHEDULE_END_BEFORE_START", fieldName: "end_time", apply: () => { row.end_time = new Date(parseTime("start_time") - 30 * 60 * 1000).toISOString().slice(0, 19).replace("T", " "); } });
  }
  if (tableName === "student_enrollment") {
    plans.push({ category: "TIMELINESS", rule: "EDU_GRADUATION_BEFORE_ENROLLMENT", fieldName: "graduation_date", apply: () => { row.graduation_date = new Date(parseTime("enrollment_date") - 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " "); } });
  }
  if (tableName === "tuition_bill") {
    plans.push({ category: "ACCURACY", rule: "EDU_PAID_EXCEEDS_RECEIVABLE", fieldName: "paid_amount", apply: () => { row.paid_amount = Number(row.receivable_amount || 0) + 500; } });
    plans.push({ category: "TIMELINESS", rule: "EDU_PAY_BEFORE_DUE", fieldName: "refund_time", apply: () => { row.refund_time = new Date(parseTime("due_time") - 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " "); } });
  }
  if (tableName === "campus_access_log") {
    plans.push({ category: "TIMELINESS", rule: "EDU_EXIT_BEFORE_ENTRY", fieldName: "exit_time", apply: () => { row.exit_time = new Date(parseTime("entry_time") - 10 * 60 * 1000).toISOString().slice(0, 19).replace("T", " "); } });
  }
  if (tableName === "library_borrow_record") {
    plans.push({ category: "TIMELINESS", rule: "EDU_RETURN_BEFORE_BORROW", fieldName: "return_time", apply: () => { row.return_time = new Date(parseTime("borrow_time") - 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " "); } });
    plans.push({ category: "CONSISTENCY", rule: "EDU_FINE_WITHOUT_OVERDUE", fieldName: "fine_amount", apply: () => { row.overdue_days = 0; row.fine_amount = 30; } });
  }
  return plans;
}

function collectEducationQualityIssues(tableName, rows, addIssue) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  const countRows = (predicate) => rows.filter((row) => predicate(row)).length;
  const parseTime = (value) => {
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? null : time;
  };
  let dirtyRows = 0;
  if (tableName === "student_profile") {
    dirtyRows += addIssue("expected_graduation_year", "EDU_GRAD_YEAR_BEFORE_ENTRANCE", "CONSISTENCY", countRows((row) => Number(row.expected_graduation_year || 0) < Number(row.entrance_year || 0)));
  }
  if (tableName === "class_schedule") {
    dirtyRows += addIssue("end_time", "EDU_SCHEDULE_END_BEFORE_START", "TIMELINESS", countRows((row) => parseTime(row.end_time) !== null && parseTime(row.start_time) !== null && parseTime(row.end_time) <= parseTime(row.start_time)));
  }
  if (tableName === "student_enrollment") {
    dirtyRows += addIssue("graduation_date", "EDU_GRADUATION_BEFORE_ENROLLMENT", "TIMELINESS", countRows((row) => parseTime(row.graduation_date) !== null && parseTime(row.enrollment_date) !== null && parseTime(row.graduation_date) < parseTime(row.enrollment_date)));
  }
  if (tableName === "tuition_bill") {
    dirtyRows += addIssue("paid_amount", "EDU_PAID_EXCEEDS_RECEIVABLE", "ACCURACY", countRows((row) => Number(row.paid_amount || 0) > Number(row.receivable_amount || 0)));
    dirtyRows += addIssue("arrears_amount", "EDU_ARREARS_NEGATIVE", "ACCURACY", countRows((row) => Number(row.arrears_amount || 0) < 0));
  }
  if (tableName === "campus_access_log") {
    dirtyRows += addIssue("exit_time", "EDU_EXIT_BEFORE_ENTRY", "TIMELINESS", countRows((row) => parseTime(row.exit_time) !== null && parseTime(row.entry_time) !== null && parseTime(row.exit_time) < parseTime(row.entry_time)));
  }
  if (tableName === "library_borrow_record") {
    dirtyRows += addIssue("return_time", "EDU_RETURN_BEFORE_BORROW", "TIMELINESS", countRows((row) => parseTime(row.return_time) !== null && parseTime(row.borrow_time) !== null && parseTime(row.return_time) < parseTime(row.borrow_time)));
    dirtyRows += addIssue("fine_amount", "EDU_FINE_WITHOUT_OVERDUE", "CONSISTENCY", countRows((row) => Number(row.overdue_days || 0) <= 0 && Number(row.fine_amount || 0) > 0));
  }
  return dirtyRows;
}

function resolveEducationAllowedValues(fieldName, scenarioProfile = {}) {
  const fromProfile = (items) => (Array.isArray(items) ? items.map((item) => String(item.code ?? item)).filter(Boolean) : []);
  if (fieldName.includes("school_type")) return fromProfile(scenarioProfile.schoolTypes);
  if (fieldName.includes("education_stage")) return fromProfile(scenarioProfile.educationStages);
  if (fieldName.includes("grade_code")) return fromProfile(scenarioProfile.gradeCodes);
  if (fieldName.includes("term_code")) return fromProfile(scenarioProfile.termCodes);
  if (fieldName.includes("subject_code")) return fromProfile(scenarioProfile.subjectCodes);
  if (fieldName.includes("role_code")) return fromProfile(scenarioProfile.staffRoles);
  if (fieldName.includes("bill_status")) return fromProfile(scenarioProfile.billStatuses);
  if (fieldName.includes("access_result")) return fromProfile(scenarioProfile.accessResults);
  if (fieldName.includes("borrow_status")) return fromProfile(scenarioProfile.borrowStatuses);
  return [];
}

module.exports = {
  buildEducationTemplate,
  buildEducationDirtyPlans,
  collectEducationQualityIssues,
  resolveEducationAllowedValues,
};
