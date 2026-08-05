function uniqueStrings(values = []) {
  return [...new Set((values || []).map((item) => String(item || "").trim()).filter(Boolean))];
}

const INDUSTRY_MODULE_ASSET_MAP = {
  ecommerce: {
    member_growth: {
      aliases: ["会员运营", "会员注册模块", "首单转化模块", "会员等级模块", "用户画像模块"],
      tables: ["customer_profile", "customer_address", "loyalty_account", "member_growth_task", "coupon_issue_record"],
      relations: ["customer_profile->customer_address", "customer_profile->loyalty_account", "customer_profile->coupon_issue_record"],
      dictSuggestions: ["member_level_dict", "register_channel_dict"],
      fieldSemantics: [
        { tableName: "loyalty_account", fieldName: "customer_id", fieldType: "BIGINT", fieldComment: "客户主键", businessSemantic: "FOREIGN_KEY", foreignKey: true, foreignRefTable: "customer_profile", foreignRefField: "customer_id", nullable: false },
        { tableName: "loyalty_account", fieldName: "loyalty_score", fieldType: "INT", fieldComment: "忠诚度积分", businessSemantic: "NUMBER", nullable: false },
      ],
    },
    promotion_event: {
      aliases: ["促销活动管理", "优惠券管理与发放模块", "促销活动保障"],
      tables: ["marketing_campaign", "coupon_template", "coupon_issue_record", "promotion_rule_config"],
      relations: ["marketing_campaign->coupon_template", "coupon_template->coupon_issue_record"],
      dictSuggestions: ["promotion_type_dict"],
    },
    catalog_merchandise: {
      aliases: ["商品目录管理模块", "商品目录"],
      tables: ["product_spu", "product_sku", "category_dict", "brand_dict"],
      relations: ["product_spu->product_sku"],
      dictSuggestions: ["category_dict", "brand_dict"],
      fieldSemantics: [
        { tableName: "product_spu", fieldName: "category_code", fieldType: "VARCHAR", fieldComment: "商品类目编码", businessSemantic: "DICT_CATEGORY", nullable: false },
        { tableName: "product_sku", fieldName: "spu_id", fieldType: "BIGINT", fieldComment: "SPU主键", businessSemantic: "FOREIGN_KEY", foreignKey: true, foreignRefTable: "product_spu", foreignRefField: "spu_id", nullable: false },
      ],
    },
    warehouse_fulfillment: {
      aliases: ["库存管理模块", "仓库管理模块", "库存履约", "仓配库存协同", "多仓库存协同"],
      tables: ["inventory_snapshot", "warehouse_info", "replenishment_order", "split_delivery_order"],
      relations: ["product_sku->inventory_snapshot", "warehouse_info->inventory_snapshot", "order_header->split_delivery_order"],
      dictSuggestions: ["inventory_status_dict", "warehouse_type_dict"],
    },
    live_stream: {
      aliases: ["直播间订单管理", "直播间商品管理模块", "直播营销互动转化"],
      tables: ["live_stream_session", "live_stream_anchor", "live_stream_interaction_log", "live_stream_goods_snapshot"],
      relations: ["merchant_store->live_stream_session", "live_stream_session->live_stream_interaction_log", "live_stream_session->live_stream_goods_snapshot"],
      dictSuggestions: ["live_platform_dict"],
    },
    payment_flow: {
      aliases: ["支付网关集成", "支付结算", "支付风控决策系统"],
      tables: ["payment_record", "settlement_record", "payment_channel_dict"],
      relations: ["order_header->payment_record", "payment_record->settlement_record"],
      dictSuggestions: ["payment_channel_dict", "payment_status_dict"],
      fieldSemantics: [
        { tableName: "settlement_record", fieldName: "payment_id", fieldType: "BIGINT", fieldComment: "支付主键", businessSemantic: "FOREIGN_KEY", foreignKey: true, foreignRefTable: "payment_record", foreignRefField: "payment_id", nullable: false },
        { tableName: "settlement_record", fieldName: "settlement_time", fieldType: "DATETIME", fieldComment: "结算时间", businessSemantic: "DATETIME", nullable: false },
      ],
    },
    enterprise_procurement: {
      aliases: ["企业账户管理", "企业客户表", "企业办公用品集采", "企业员工福利采购"],
      tables: ["enterprise_customer", "enterprise_procurement_order", "enterprise_payment_record", "contract_archive"],
      relations: ["enterprise_customer->enterprise_procurement_order", "enterprise_procurement_order->enterprise_payment_record"],
      dictSuggestions: ["enterprise_type_dict"],
    },
    invoice_center: {
      aliases: ["增值税发票管理", "发票表", "invoice_center"],
      tables: ["invoice_center", "invoice_issue_record"],
      relations: ["order_header->invoice_center", "invoice_center->invoice_issue_record"],
      dictSuggestions: ["invoice_status_dict"],
    },
    omnichannel_store: {
      aliases: ["门店订单处理", "门店信息表", "门店自提"],
      tables: ["merchant_store", "store_pickup_order", "store_staff_profile"],
      relations: ["merchant_store->store_pickup_order"],
      dictSuggestions: ["store_type_dict"],
    },
    store_service: {
      aliases: ["用户到店核销", "提货凭证管理", "自提履约状态跟踪模块"],
      tables: ["store_pickup_verification", "pickup_service_record"],
      relations: ["store_pickup_order->store_pickup_verification", "store_pickup_verification->pickup_service_record"],
    },
    refund_after_sale: {
      aliases: ["退货申请模块", "售后审核与判定", "退款审批模块"],
      tables: ["refund_ticket", "after_sale_audit_record", "refund_approval_record"],
      relations: ["order_header->refund_ticket", "refund_ticket->after_sale_audit_record", "refund_ticket->refund_approval_record"],
      dictSuggestions: ["refund_reason_dict", "refund_status_dict"],
    },
    return_logistics: {
      aliases: ["逆向物流管理", "逆向物流跟踪模块"],
      tables: ["reverse_logistics_order", "reverse_logistics_trace"],
      relations: ["refund_ticket->reverse_logistics_order", "reverse_logistics_order->reverse_logistics_trace"],
    },
    flash_sale: {
      aliases: ["秒杀系统", "秒杀活动表", "秒杀订单表"],
      tables: ["flash_sale_activity", "flash_sale_item", "flash_sale_order_record"],
      relations: ["flash_sale_activity->flash_sale_item", "flash_sale_item->flash_sale_order_record"],
    },
    risk_control: {
      aliases: ["风险订单识别引擎", "用户行为分析模块", "商户信用评估模块"],
      tables: ["customer_risk_profile", "risk_rule_config", "risk_event_record"],
      relations: ["customer_profile->customer_risk_profile", "risk_rule_config->risk_event_record"],
    },
    delivery_mix: {
      aliases: ["履约状态追踪与预警", "物流状态跟踪模块", "末端签收与异常处理"],
      tables: ["logistics_delivery", "delivery_sign_record", "delivery_exception_record"],
      relations: ["order_header->logistics_delivery", "logistics_delivery->delivery_sign_record", "logistics_delivery->delivery_exception_record"],
    },
    loyalty: {
      aliases: ["会员忠诚度管理", "复购周期分析", "积分与权益兑换"],
      tables: ["loyalty_account", "customer_preference_tag", "member_benefit_exchange"],
      relations: ["customer_profile->loyalty_account", "customer_profile->customer_preference_tag", "loyalty_account->member_benefit_exchange"],
    },
  },
  traffic: {
    violation_processing: {
      aliases: ["违法处理", "违法抓拍设备接入模块", "违法图像智能识别模块", "违法信息审核与录入模块"],
      tables: ["violation_record", "violation_image_evidence", "violation_notice_record", "violation_code_dict"],
      relations: ["vehicle_archive->violation_record", "violation_record->violation_image_evidence", "violation_record->violation_notice_record"],
      dictSuggestions: ["violation_code_dict", "violation_status_dict"],
    },
    payment_reconcile: {
      aliases: ["罚款在线支付与对账模块", "罚款缴纳与对账"],
      tables: ["penalty_payment", "payment_reconcile_record", "payment_channel_dict"],
      relations: ["violation_record->penalty_payment", "penalty_payment->payment_reconcile_record"],
      dictSuggestions: ["payment_channel_dict"],
    },
    checkpoint_control: {
      aliases: ["卡口监管", "卡口设备状态监控", "路检路查", "现场检查与取证"],
      tables: ["checkpoint_inspection", "checkpoint_info", "checkpoint_device_archive", "checkpoint_vehicle_pass_record"],
      relations: ["vehicle_archive->checkpoint_inspection", "checkpoint_info->checkpoint_inspection", "checkpoint_info->checkpoint_vehicle_pass_record"],
      dictSuggestions: ["inspection_result_dict"],
    },
    camera_network: {
      aliases: ["卡口视频智能分析模块", "布控名单比对模块"],
      tables: ["camera_network_node", "camera_capture_record", "control_warning_rule"],
      relations: ["camera_network_node->camera_capture_record", "control_warning_rule->camera_capture_record"],
    },
    document_service: {
      aliases: ["执法文书生成与管理模块", "违法告知与文书送达", "告知文书表"],
      tables: ["enforcement_document", "notice_delivery_record", "document_archive_file"],
      relations: ["violation_record->enforcement_document", "enforcement_document->notice_delivery_record", "enforcement_document->document_archive_file"],
      dictSuggestions: ["document_type_dict"],
    },
    accident_case: {
      aliases: ["事故处置", "事故接警中心", "事故案件"],
      tables: ["accident_case", "accident_evidence_material", "accident_disposal_record"],
      relations: ["vehicle_archive->accident_case", "accident_case->accident_evidence_material", "accident_case->accident_disposal_record"],
    },
    dispatch_patrol: {
      aliases: ["巡逻派单", "警力智能调度", "任务派发", "巡逻任务"],
      tables: ["dispatch_task", "patrol_log", "patrol_team_schedule"],
      relations: ["accident_case->dispatch_task", "dispatch_task->patrol_log", "dispatch_task->patrol_team_schedule"],
    },
    night_shift: {
      aliases: ["夜间巡逻", "夜间巡逻任务管理模块", "夜间排班"],
      tables: ["night_patrol_schedule", "night_patrol_event"],
      relations: ["patrol_team_schedule->night_patrol_schedule", "night_patrol_schedule->night_patrol_event"],
    },
    school_zone: {
      aliases: ["校区护学", "护学告知文书自动生成与推送模块", "学校信息表"],
      tables: ["school_zone_info", "school_zone_control_record", "temporary_stop_inspection"],
      relations: ["school_zone_info->school_zone_control_record", "school_zone_control_record->temporary_stop_inspection"],
    },
    new_energy: {
      aliases: ["新能源监管", "新能源车辆备案登记模块"],
      tables: ["new_energy_vehicle_filing", "battery_safety_inspection", "vehicle_pass_feature"],
      relations: ["vehicle_archive->new_energy_vehicle_filing", "new_energy_vehicle_filing->battery_safety_inspection"],
      dictSuggestions: ["new_energy_type_dict"],
    },
    vehicle_registration: {
      aliases: ["车辆档案", "车辆识别与抓拍模块"],
      tables: ["owner_profile", "vehicle_archive", "registration_record"],
      relations: ["owner_profile->vehicle_archive", "vehicle_archive->registration_record"],
      dictSuggestions: ["vehicle_type_dict"],
    },
    driver_profile: {
      aliases: ["驾驶员档案管理", "驾驶员信息表"],
      tables: ["driver_profile", "driver_license_record", "driver_risk_profile"],
      relations: ["owner_profile->driver_profile", "driver_profile->driver_license_record", "driver_profile->driver_risk_profile"],
    },
    road_safety: {
      aliases: ["重点车辆动态布控", "历史违法预警联动", "历史风险画像表"],
      tables: ["key_vehicle_watchlist", "warning_event_record", "vehicle_risk_profile"],
      relations: ["vehicle_archive->key_vehicle_watchlist", "key_vehicle_watchlist->warning_event_record", "vehicle_archive->vehicle_risk_profile"],
    },
    appeal_trace: {
      aliases: ["申诉复核", "线上申诉受理", "复核决定下达", "文书电子归档"],
      tables: ["appeal_application", "appeal_acceptance_record", "appeal_review_case", "review_evidence_material", "review_decision_notice", "document_revoke_record", "electronic_archive_file"],
      relations: ["violation_record->appeal_application", "appeal_application->appeal_acceptance_record", "appeal_acceptance_record->appeal_review_case", "appeal_review_case->review_evidence_material", "appeal_review_case->review_decision_notice", "review_decision_notice->document_revoke_record", "review_decision_notice->electronic_archive_file"],
      dictSuggestions: ["appeal_reason_dict", "review_result_dict"],
    },
    highway_ops: {
      aliases: ["高速稽查", "超限超载车辆入口拦截", "稽查记录"],
      tables: ["highway_weight_check_record", "highway_entry_checkpoint", "overload_vehicle_record"],
      relations: ["vehicle_archive->highway_weight_check_record", "highway_entry_checkpoint->highway_weight_check_record", "highway_weight_check_record->overload_vehicle_record"],
    },
  },
};

const INDUSTRY_CHINESE_TABLE_ALIASES = {
  ecommerce: [
    [/会员(信息)?表|用户(信息)?表|客户(信息)?表/, "customer_profile"],
    [/收货地址表|地址信息表/, "customer_address"],
    [/门店信息表|商户门店表/, "merchant_store"],
    [/商品信息表|商品主表|商品表/, "product_spu"],
    [/商品sku表|sku表|商品明细表/, "product_sku"],
    [/库存表|商品库存表|门店库存表/, "inventory_snapshot"],
    [/仓库表|仓库主表/, "warehouse_info"],
    [/订单信息表|订单主表|订单表/, "order_header"],
    [/订单商品明细表|订单明细表|订单商品表/, "order_item"],
    [/支付(流水|记录)表/, "payment_record"],
    [/退款(记录|申请)表|退货申请单/, "refund_ticket"],
    [/物流(信息|记录|单)表|配送单表/, "logistics_delivery"],
    [/直播间表/, "live_stream_session"],
    [/主播表/, "live_stream_anchor"],
    [/直播互动(记录|日志)表/, "live_stream_interaction_log"],
    [/企业客户表/, "enterprise_customer"],
    [/采购订单表|企业订单表/, "enterprise_procurement_order"],
    [/发票表|开票中心表/, "invoice_center"],
    [/优惠券表/, "coupon_template"],
    [/会员等级表/, "member_level_dict"],
    [/分类字典表|商品分类表/, "category_dict"],
    [/支付渠道表/, "payment_channel_dict"],
    [/物流公司表/, "courier_company_dict"],
    [/自提履约单|核销记录表/, "store_pickup_verification"],
    [/售后审核记录/, "after_sale_audit_record"],
    [/逆向物流单/, "reverse_logistics_order"],
    [/秒杀活动表/, "flash_sale_activity"],
    [/秒杀商品表/, "flash_sale_item"],
    [/用户参与记录表/, "flash_sale_order_record"],
    [/账户画像表|风险画像表/, "customer_risk_profile"],
    [/风险规则表/, "risk_rule_config"],
    [/风险事件表/, "risk_event_record"],
    [/签收记录表/, "delivery_sign_record"],
    [/拆单规则表/, "split_delivery_order"],
    [/偏好标签表/, "customer_preference_tag"],
  ],
  traffic: [
    [/当事人信息表|驾驶员信息表|执勤人员|复核人员表/, "owner_profile"],
    [/涉案车辆信息表|车辆信息表|车辆档案|巡逻车辆|稽查车辆/, "vehicle_archive"],
    [/原始违法记录表|违法记录表/, "violation_record"],
    [/交通违法申诉申请表|申诉申请表|申诉记录表/, "appeal_application"],
    [/申诉受理登记表/, "appeal_acceptance_record"],
    [/复核案件立案表|复核记录表|复核案件表/, "appeal_review_case"],
    [/复核证据材料表|现场证据/, "review_evidence_material"],
    [/复核意见审批表/, "review_opinion_approval"],
    [/复核决定通知书|处罚决定表/, "review_decision_notice"],
    [/执法文书撤销记录表/, "document_revoke_record"],
    [/电子卷宗归档表|文书归档表|归档文件/, "electronic_archive_file"],
    [/复核流程日志表|处置记录/, "appeal_review_process_log"],
    [/通知送达记录表|告知记录表/, "notice_delivery_record"],
    [/复核机构信息表/, "review_agency_info"],
    [/常用违法代码字典表|违法代码表|违法行为代码表|违规类型字典/, "violation_code_dict"],
    [/支付渠道表/, "payment_channel_dict"],
    [/路口信息表|检查点信息表|卡口设备|稽查卡口/, "checkpoint_info"],
    [/车辆通行记录/, "checkpoint_vehicle_pass_record"],
    [/布控预警规则/, "control_warning_rule"],
    [/重点车辆名单/, "key_vehicle_watchlist"],
    [/布控任务表|布控预警/, "control_task"],
    [/核查任务/, "verification_task"],
    [/现场检查记录表|路检记录表|稽查记录|临停检查记录表/, "checkpoint_inspection"],
    [/执法文书表|告知文书表/, "enforcement_document"],
    [/事故案件/, "accident_case"],
    [/巡逻任务|任务派发|稽查任务/, "dispatch_task"],
    [/巡逻路线/, "patrol_route"],
    [/异常事件|预警事件表/, "warning_event_record"],
    [/巡逻班组|夜间排班/, "patrol_team_schedule"],
    [/学校信息表/, "school_zone_info"],
    [/交通管控记录表/, "school_zone_control_record"],
    [/新能源车辆备案表/, "new_energy_vehicle_filing"],
    [/通行特征表/, "vehicle_pass_feature"],
    [/车辆类型表/, "vehicle_type_dict"],
    [/历史风险画像表/, "vehicle_risk_profile"],
    [/稽查记录/, "highway_weight_check_record"],
    [/超限车辆/, "overload_vehicle_record"],
  ],
};

function findIndustryModuleAssets(industry, moduleKeyOrLabel) {
  const normalized = String(moduleKeyOrLabel || "").trim();
  if (!normalized) return null;
  const modules = INDUSTRY_MODULE_ASSET_MAP[String(industry || "").toLowerCase()] || {};
  for (const [moduleKey, assets] of Object.entries(modules)) {
    const aliases = uniqueStrings([moduleKey, ...(Array.isArray(assets.aliases) ? assets.aliases : [])]);
    if (aliases.some((item) => item === normalized)) {
      return { moduleKey, ...assets };
    }
    if (aliases.some((item) => normalized.includes(item) || item.includes(normalized))) {
      return { moduleKey, ...assets };
    }
  }
  return null;
}

function mapChineseResearchTableAlias(industry, rawLabel) {
  const label = String(rawLabel || "").trim();
  const rules = INDUSTRY_CHINESE_TABLE_ALIASES[String(industry || "").toLowerCase()] || [];
  for (const [pattern, target] of rules) {
    if (pattern.test(label)) {
      return target;
    }
  }
  return "";
}

module.exports = {
  INDUSTRY_CHINESE_TABLE_ALIASES,
  INDUSTRY_MODULE_ASSET_MAP,
  findIndustryModuleAssets,
  mapChineseResearchTableAlias,
  uniqueStrings,
};
