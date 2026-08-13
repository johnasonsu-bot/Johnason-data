-- aviation_ontology_demo governance migration (PostgreSQL / ods)
-- Idempotent: safe to rerun for the demo dataset.

BEGIN;

-- 1. Primary/business keys and audit fields.
ALTER TABLE ods_aircraft_tail ALTER COLUMN tail_no SET NOT NULL;
ALTER TABLE ods_crew_roster ALTER COLUMN crew_id SET NOT NULL;
ALTER TABLE ods_flight_schedule ALTER COLUMN flight_segment_id SET NOT NULL;
ALTER TABLE ods_weather_metar ALTER COLUMN airport_icao SET NOT NULL, ALTER COLUMN observe_time SET NOT NULL;
ALTER TABLE ods_runway_slot ALTER COLUMN airport_icao SET NOT NULL, ALTER COLUMN runway_id SET NOT NULL, ALTER COLUMN slot_hour SET NOT NULL;
ALTER TABLE ods_pax_connection ALTER COLUMN pax_id SET NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='ods_aircraft_tail'::regclass AND contype='p') THEN ALTER TABLE ods_aircraft_tail ADD CONSTRAINT ods_aircraft_tail_pkey PRIMARY KEY (tail_no); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='ods_crew_roster'::regclass AND contype='p') THEN ALTER TABLE ods_crew_roster ADD CONSTRAINT ods_crew_roster_pkey PRIMARY KEY (crew_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='ods_flight_schedule'::regclass AND contype='p') THEN ALTER TABLE ods_flight_schedule ADD CONSTRAINT ods_flight_schedule_pkey PRIMARY KEY (flight_segment_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='ods_weather_metar'::regclass AND contype='p') THEN ALTER TABLE ods_weather_metar ADD CONSTRAINT ods_weather_metar_pkey PRIMARY KEY (airport_icao,observe_time); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='ods_runway_slot'::regclass AND contype='p') THEN ALTER TABLE ods_runway_slot ADD CONSTRAINT ods_runway_slot_pkey PRIMARY KEY (airport_icao,runway_id,slot_hour); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='ods_pax_connection'::regclass AND contype='p') THEN ALTER TABLE ods_pax_connection ADD CONSTRAINT ods_pax_connection_pkey PRIMARY KEY (pax_id); END IF;
END $$;

ALTER TABLE aviationweather_icao_batches ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE meta_resource_registry ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE ods_aircraft_tail ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE ods_crew_roster ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE ods_flight_schedule ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE ods_flight_schedule ADD COLUMN IF NOT EXISTS record_source varchar(32);
ALTER TABLE ods_flight_schedule ADD COLUMN IF NOT EXISTS source_record_id varchar(160);
ALTER TABLE ods_flight_schedule ADD COLUMN IF NOT EXISTS business_key varchar(320);
ALTER TABLE ods_flight_schedule ADD COLUMN IF NOT EXISTS source_updated_at timestamptz;
ALTER TABLE ods_flight_schedule ADD COLUMN IF NOT EXISTS ingested_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE ods_flight_schedule ADD COLUMN IF NOT EXISTS raw_payload jsonb;
ALTER TABLE ods_flight_schedule ALTER COLUMN tail_no DROP NOT NULL;
UPDATE ods_flight_schedule
SET record_source=COALESCE(NULLIF(record_source,''),'MANUAL'),
    source_record_id=COALESCE(NULLIF(source_record_id,''),flight_segment_id),
    business_key=COALESCE(NULLIF(business_key,''),concat_ws('|',carrier_code,flight_no,substr(std,1,10),dep_airport,arr_airport,std)),
    source_updated_at=COALESCE(source_updated_at,updated_at),
    ingested_at=COALESCE(ingested_at,updated_at,now());
ALTER TABLE ods_flight_schedule ALTER COLUMN record_source SET NOT NULL;
ALTER TABLE ods_flight_schedule ALTER COLUMN source_record_id SET NOT NULL;
ALTER TABLE ods_flight_schedule ALTER COLUMN business_key SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ods_flight_schedule_source_record ON ods_flight_schedule(record_source,source_record_id);
CREATE INDEX IF NOT EXISTS idx_ods_flight_schedule_business_key ON ods_flight_schedule(business_key);
ALTER TABLE ods_weather_metar ADD COLUMN IF NOT EXISTS ingested_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE ods_runway_slot ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE ods_pax_connection ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 2. Resource governance metadata.
ALTER TABLE meta_resource_registry ADD COLUMN IF NOT EXISTS res_code varchar(32);
ALTER TABLE meta_resource_registry ADD COLUMN IF NOT EXISTS res_name varchar(128);
ALTER TABLE meta_resource_registry ADD COLUMN IF NOT EXISTS table_name varchar(128);
ALTER TABLE meta_resource_registry ADD COLUMN IF NOT EXISTS ds_code varchar(32);
ALTER TABLE meta_resource_registry ADD COLUMN IF NOT EXISTS dept_code varchar(32);
ALTER TABLE meta_resource_registry ADD COLUMN IF NOT EXISTS sys_code varchar(32);
ALTER TABLE meta_resource_registry ADD COLUMN IF NOT EXISTS org_category varchar(32);
ALTER TABLE meta_resource_registry ADD COLUMN IF NOT EXISTS semantic_tag varchar(128);
ALTER TABLE meta_resource_registry ADD COLUMN IF NOT EXISTS res_status varchar(32);

INSERT INTO meta_resource_registry(project_id,resource_name,resource_type,publish_status,res_code,res_name,table_name,ds_code,dept_code,sys_code,org_category,semantic_tag,res_status)
VALUES
 (7,'ods_aircraft_tail','TABLE','PUBLISHED','R001','飞机机尾台账','ods_aircraft_tail','DS03','D200','S03','ods','运行资源/航空器','PUBLISHED'),
 (7,'ods_flight_schedule','TABLE','PUBLISHED','R002','航班计划架次','ods_flight_schedule','DS01','D110','S01','ods','运行计划/航班','PUBLISHED'),
 (7,'ods_crew_roster','TABLE','PUBLISHED','R003','机组排班表','ods_crew_roster','DS02','D120','S02','ods','人员资源/机组','PUBLISHED'),
 (7,'ods_weather_metar','TABLE','PUBLISHED','R004','气象观测报文','ods_weather_metar','DS04','D110','S04','ods','外部环境/气象','PUBLISHED'),
 (7,'ods_runway_slot','TABLE','PUBLISHED','R005','跑道容量时刻','ods_runway_slot','DS05','D300','S05','ods','机场资源/跑道','PUBLISHED'),
 (7,'ods_pax_connection','TABLE','PUBLISHED','R006','旅客中转保障','ods_pax_connection','DS01','D300','S05','ods','旅客服务/中转','PUBLISHED'),
 (7,'ods_action_log','TABLE','PUBLISHED','R007','处置动作日志','ods_action_log','DS05','D110','S01','dwd','运行处置/审计','PUBLISHED')
ON CONFLICT(project_id,resource_name) DO UPDATE SET
 publish_status=excluded.publish_status,res_code=excluded.res_code,res_name=excluded.res_name,
 table_name=excluded.table_name,ds_code=excluded.ds_code,dept_code=excluded.dept_code,
 sys_code=excluded.sys_code,org_category=excluded.org_category,
 semantic_tag=excluded.semantic_tag,res_status=excluded.res_status,updated_at=now();

CREATE UNIQUE INDEX IF NOT EXISTS uq_meta_resource_registry_res_code ON meta_resource_registry(res_code) WHERE res_code IS NOT NULL;

-- 3. Standard dictionaries and mappings.
CREATE TABLE IF NOT EXISTS dim_delay_code_coda(
 raw_code varchar(32) PRIMARY KEY,coda_code varchar(8) NOT NULL,
 delay_category varchar(32) NOT NULL,category_cn varchar(32) NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO dim_delay_code_coda(raw_code,coda_code,delay_category,category_cn) VALUES
 ('WX','71','WEATHER','天气'),('weather-thunderstorm','71','WEATHER','天气'),
 ('71','71','WEATHER','天气'),('天气原因','71','WEATHER','天气'),
 ('CREW_OVER','63','CREW','机组'),('TECH-MEL','41','TECHNICAL','航空器技术'),
 ('AIRPORT_SLOT','89','AIRPORT','机场设施与时刻'),('89','89','AIRPORT','机场设施与时刻'),
 ('ATC_FLOW','81','ATC','空管流量'),('','00','NONE','无延误')
ON CONFLICT(raw_code) DO UPDATE SET coda_code=excluded.coda_code,delay_category=excluded.delay_category,category_cn=excluded.category_cn,updated_at=now();

CREATE TABLE IF NOT EXISTS meta_standard_mapping(
 res_code varchar(32) NOT NULL,field_name varchar(64) NOT NULL,std_element_code varchar(32) NOT NULL,
 std_element_name varchar(64) NOT NULL,value_domain varchar(32) NOT NULL,map_status varchar(16) NOT NULL,
 PRIMARY KEY(res_code,field_name)
);
INSERT INTO meta_standard_mapping VALUES
 ('R002','delay_code_raw','SE-DLY-001','航班延误原因代码','CODA_DELAY','MAPPED'),
 ('R002','flight_no','SE-FLT-001','航班号','IATA_FLTNO','MAPPED'),
 ('R002','dep_airport','SE-APT-001','机场四字代码','ICAO_APT','MAPPED'),
 ('R001','tail_no','SE-ACF-001','航空器注册号','TAIL_REG','MAPPED'),
 ('R003','crew_id','SE-CRW-001','机组人员编号','CREW_ID','MAPPED'),
 ('R003','duty_hours','SE-CRW-002','连续值勤时长','HOURS','MAPPED')
ON CONFLICT(res_code,field_name) DO UPDATE SET std_element_code=excluded.std_element_code,std_element_name=excluded.std_element_name,value_domain=excluded.value_domain,map_status=excluded.map_status;

-- 4. Deduplicated action log and quality rules.
CREATE TABLE IF NOT EXISTS ods_action_log_clean(
 action_id text PRIMARY KEY,flight_segment_id text,flight_no text,action_type text,
 action_time text,operator text,plan_code text,action_status text,updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO ods_action_log_clean(action_id,flight_segment_id,flight_no,action_type,action_time,operator,plan_code,action_status)
SELECT action_id,MIN(flight_segment_id),MIN(flight_no),MIN(action_type),MIN(action_time),MIN(operator),MIN(plan_code),MIN(action_status)
FROM ods_action_log WHERE action_id IS NOT NULL AND action_id<>'' GROUP BY action_id
ON CONFLICT(action_id) DO UPDATE SET flight_segment_id=excluded.flight_segment_id,flight_no=excluded.flight_no,action_type=excluded.action_type,action_time=excluded.action_time,operator=excluded.operator,plan_code=excluded.plan_code,action_status=excluded.action_status,updated_at=now();

CREATE TABLE IF NOT EXISTS meta_quality_rule(
 rule_code varchar(16) PRIMARY KEY,res_code varchar(32) NOT NULL,field_name varchar(64) NOT NULL,
 rule_type varchar(24) NOT NULL,rule_expr varchar(200) NOT NULL,severity varchar(16) NOT NULL,
 rule_status varchar(16) NOT NULL DEFAULT 'ACTIVE',updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO meta_quality_rule(rule_code,res_code,field_name,rule_type,rule_expr,severity) VALUES
 ('Q001','R007','action_id','UNIQUE','count(distinct action_id) = count(1)','HIGH'),
 ('Q002','R002','flight_segment_id','NOT_NULL','flight_segment_id is not null','HIGH'),
 ('Q003','R002','delay_code_raw','CODE_SET','delay_code_raw in dim_delay_code_coda','HIGH'),
 ('Q004','R003','duty_hours','RANGE','duty_hours between 0 and 13','HIGH'),
 ('Q005','R003','rest_hours','RANGE','rest_hours >= 10','HIGH'),
 ('Q006','R001','remain_flight_hours','RANGE','remain_flight_hours >= 0','MEDIUM'),
 ('Q007','R005','capacity_ratio','RANGE','capacity_ratio between 0 and 1','MEDIUM'),
 ('Q008','R002','business_key','NOT_NULL','business_key is not null','HIGH'),
 ('Q009','R002','carrier_code','CODE_SET','record_source <> ''AVIATIONSTACK'' or carrier_code = ''CZ''','HIGH'),
 ('Q010','R002','dep_airport','CODE_SET','record_source <> ''AVIATIONSTACK'' or dep_airport = ''ZGGG''','HIGH'),
 ('Q011','R002','sta','CONSISTENCY','sta >= std','HIGH'),
 ('Q012','R002','delay_minutes','RANGE','delay_minutes >= 0','HIGH'),
 ('Q013','R002','business_key','DUPLICATE_REVIEW','count(distinct record_source) by business_key <= 1','MEDIUM')
ON CONFLICT(rule_code) DO UPDATE SET res_code=excluded.res_code,field_name=excluded.field_name,rule_type=excluded.rule_type,rule_expr=excluded.rule_expr,severity=excluded.severity,rule_status='ACTIVE',updated_at=now();

-- 5. Ontology entity, relation and rule views.
CREATE OR REPLACE VIEW dwd_ent_flight_segment AS
SELECT f.flight_segment_id entity_id,'FlightSegment'::text entity_class,f.flight_no,f.dep_airport,f.arr_airport,f.segment_type,
 f.std,f.sta,f.atd,f.flight_status,f.delay_minutes::numeric delay_minutes,f.tail_no,f.delay_code_raw,
 d.coda_code delay_code_std,d.category_cn delay_category_cn,
 CASE WHEN f.delay_minutes IS NULL OR f.delay_minutes::numeric=0 THEN 'ON_TIME'
      WHEN f.delay_minutes::numeric<60 THEN 'MINOR' WHEN f.delay_minutes::numeric<120 THEN 'MAJOR' ELSE 'SEVERE' END delay_grade
FROM ods_flight_schedule f LEFT JOIN dim_delay_code_coda d ON d.raw_code=COALESCE(f.delay_code_raw,'');

CREATE OR REPLACE VIEW dwd_ent_aircraft_tail AS SELECT tail_no entity_id,'AircraftTail'::text entity_class,aircraft_model,cabin_class,remain_flight_hours::numeric remain_flight_hours,current_station,CASE WHEN COALESCE(mel_defect,'')='' THEN 0 ELSE 1 END has_mel_defect,tail_status FROM ods_aircraft_tail;
CREATE OR REPLACE VIEW dwd_ent_crew_member AS SELECT crew_id entity_id,'CrewMember'::text entity_class,crew_role,qualified_model,duty_start,duty_hours::numeric duty_hours,duty_limit_hours::numeric duty_limit_hours,rest_hours::numeric rest_hours,rest_min_hours::numeric rest_min_hours,assigned_flight_no,base_station,duty_limit_hours::numeric-duty_hours::numeric duty_headroom_hours FROM ods_crew_roster;
CREATE OR REPLACE VIEW dwd_ent_weather_event AS SELECT airport_icao||'#'||observe_time entity_id,'WeatherEvent'::text entity_class,airport_icao,observe_time,weather_phenomenon,visibility_m,wind_gust_kt,severity_level FROM ods_weather_metar WHERE severity_level='SEVERE';
CREATE OR REPLACE VIEW dwd_ent_runway_capacity AS SELECT airport_icao||'#'||runway_id||'#'||slot_hour entity_id,'RunwayCapacity'::text entity_class,airport_icao,runway_id,slot_hour,NULLIF(declared_capacity,'')::numeric declared_capacity,NULLIF(available_capacity,'')::numeric available_capacity,NULLIF(capacity_ratio,'')::numeric capacity_ratio,restriction_reason FROM ods_runway_slot;

CREATE OR REPLACE VIEW dwd_rel_flight_operated_by_tail AS SELECT f.flight_segment_id src_id,'operatedBy'::text rel_type,t.tail_no dst_id,t.aircraft_model,t.cabin_class,t.remain_flight_hours,t.tail_status FROM ods_flight_schedule f JOIN ods_aircraft_tail t ON t.tail_no=f.tail_no;
CREATE OR REPLACE VIEW dwd_rel_flight_staffed_by_crew AS SELECT f.flight_segment_id src_id,'staffedBy'::text rel_type,c.crew_id dst_id,c.crew_role,c.duty_hours::numeric duty_hours,c.duty_limit_hours::numeric duty_limit_hours,c.rest_hours::numeric rest_hours,c.rest_min_hours::numeric rest_min_hours FROM ods_flight_schedule f JOIN ods_crew_roster c ON c.assigned_flight_no=f.flight_no;
CREATE OR REPLACE VIEW dwd_rel_weather_impacts_flight AS SELECT w.entity_id src_id,'impacts'::text rel_type,f.flight_segment_id dst_id,w.weather_phenomenon,w.wind_gust_kt,f.delay_minutes FROM dwd_ent_weather_event w JOIN ods_flight_schedule f ON f.dep_airport=w.airport_icao AND substr(f.std,1,13)=substr(w.observe_time,1,13);

CREATE OR REPLACE VIEW dwd_rule_weather_delay_inferred AS SELECT DISTINCT r.dst_id flight_segment_id,f.flight_no,'WeatherDelayedFlight'::text inferred_class,r.weather_phenomenon,f.delay_minutes,f.delay_code_std FROM dwd_rel_weather_impacts_flight r JOIN dwd_ent_flight_segment f ON f.entity_id=r.dst_id WHERE f.delay_minutes>0;
CREATE OR REPLACE VIEW dwd_rule_crew_duty_violation AS SELECT s.dst_id crew_id,s.src_id flight_segment_id,s.crew_role,s.duty_hours,s.duty_limit_hours,s.rest_hours,s.rest_min_hours,CASE WHEN s.duty_hours>s.duty_limit_hours THEN 'DUTY_OVER_LIMIT' WHEN s.rest_hours<s.rest_min_hours THEN 'REST_UNDER_MIN' ELSE 'OK' END violation_type FROM dwd_rel_flight_staffed_by_crew s WHERE s.duty_hours>s.duty_limit_hours OR s.rest_hours<s.rest_min_hours;
CREATE OR REPLACE VIEW dwd_action_log AS SELECT action_id,flight_segment_id,flight_no,action_type,action_time,operator,plan_code,action_status FROM ods_action_log_clean;

-- 6. Table and field descriptions for the seven research findings.
COMMENT ON TABLE aviationweather_icao_batches IS 'AviationWeather.gov 中国大陆机场请求批次；负责人：运行控制中心数据接入组';
COMMENT ON COLUMN aviationweather_icao_batches.batch_no IS '批次序号，主键'; COMMENT ON COLUMN aviationweather_icao_batches.icao_ids_csv IS '本批次 ICAO 代码，逗号分隔，最多50个'; COMMENT ON COLUMN aviationweather_icao_batches.airport_count IS '本批次机场数量'; COMMENT ON COLUMN aviationweather_icao_batches.updated_at IS '批次配置更新时间，增量审计字段';
COMMENT ON TABLE meta_resource_registry IS '航空本体项目资源注册与责任归属清单；负责人：数据治理组';
COMMENT ON COLUMN meta_resource_registry.project_id IS '项目ID'; COMMENT ON COLUMN meta_resource_registry.resource_name IS '资源物理名称'; COMMENT ON COLUMN meta_resource_registry.resource_type IS '资源类型'; COMMENT ON COLUMN meta_resource_registry.publish_status IS '发布状态'; COMMENT ON COLUMN meta_resource_registry.registered_at IS '注册时间';
COMMENT ON COLUMN meta_resource_registry.updated_at IS '治理元数据更新时间/增量游标'; COMMENT ON COLUMN meta_resource_registry.res_code IS '项目内资源编码，唯一'; COMMENT ON COLUMN meta_resource_registry.res_name IS '资源中文名称'; COMMENT ON COLUMN meta_resource_registry.table_name IS '对应物理表名'; COMMENT ON COLUMN meta_resource_registry.ds_code IS '来源数据源编码'; COMMENT ON COLUMN meta_resource_registry.dept_code IS '责任部门编码'; COMMENT ON COLUMN meta_resource_registry.sys_code IS '所属业务系统编码'; COMMENT ON COLUMN meta_resource_registry.org_category IS '组织分类层级'; COMMENT ON COLUMN meta_resource_registry.semantic_tag IS '语义分类标签'; COMMENT ON COLUMN meta_resource_registry.res_status IS '治理发布状态';
COMMENT ON TABLE ods_aircraft_tail IS '航空器机尾、适航和当前站点台账；负责人：机务工程部'; COMMENT ON TABLE ods_crew_roster IS '机组排班、资质和值勤合规台账；负责人：机组资源席'; COMMENT ON TABLE ods_flight_schedule IS '航班架次计划、执行状态和延误信息；负责人：签派席';
COMMENT ON TABLE ods_china_airport_current_weather IS '中国大陆283机场当前天气铺底总表；无报文机场标记NO_CURRENT_REPORT；负责人：气象接入组'; COMMENT ON TABLE stg_aviationweather_current_metar IS 'AviationWeather.gov 当前METAR原始暂存快照；负责人：气象接入组';

COMMENT ON COLUMN ods_aircraft_tail.tail_no IS '机尾号，AircraftTail业务主键'; COMMENT ON COLUMN ods_aircraft_tail.aircraft_model IS '机型'; COMMENT ON COLUMN ods_aircraft_tail.cabin_class IS '宽窄体分类'; COMMENT ON COLUMN ods_aircraft_tail.remain_flight_hours IS '剩余可飞小时'; COMMENT ON COLUMN ods_aircraft_tail.last_check_time IS '最近检修时间'; COMMENT ON COLUMN ods_aircraft_tail.mel_defect IS 'MEL缺陷描述'; COMMENT ON COLUMN ods_aircraft_tail.tail_status IS '航空器可用状态'; COMMENT ON COLUMN ods_aircraft_tail.current_station IS '当前机场ICAO'; COMMENT ON COLUMN ods_aircraft_tail.updated_at IS '记录更新时间/增量游标';
COMMENT ON COLUMN ods_crew_roster.crew_id IS '机组人员编号，CrewMember业务主键'; COMMENT ON COLUMN ods_crew_roster.crew_name IS '机组姓名'; COMMENT ON COLUMN ods_crew_roster.crew_role IS '机组角色'; COMMENT ON COLUMN ods_crew_roster.qualified_model IS '可执飞机型'; COMMENT ON COLUMN ods_crew_roster.duty_start IS '值勤开始时间'; COMMENT ON COLUMN ods_crew_roster.duty_hours IS '连续值勤小时'; COMMENT ON COLUMN ods_crew_roster.duty_limit_hours IS '值勤上限小时'; COMMENT ON COLUMN ods_crew_roster.rest_hours IS '已休息小时'; COMMENT ON COLUMN ods_crew_roster.rest_min_hours IS '最低休息小时'; COMMENT ON COLUMN ods_crew_roster.assigned_flight_no IS '分配航班号'; COMMENT ON COLUMN ods_crew_roster.base_station IS '基地机场ICAO'; COMMENT ON COLUMN ods_crew_roster.compliance_flag IS '合规标记'; COMMENT ON COLUMN ods_crew_roster.updated_at IS '记录更新时间/增量游标';
COMMENT ON COLUMN ods_flight_schedule.flight_segment_id IS '航班架次ID，FlightSegment业务主键'; COMMENT ON COLUMN ods_flight_schedule.flight_no IS '航班号'; COMMENT ON COLUMN ods_flight_schedule.dep_airport IS '起飞机场ICAO'; COMMENT ON COLUMN ods_flight_schedule.arr_airport IS '到达机场ICAO'; COMMENT ON COLUMN ods_flight_schedule.segment_type IS '国内/国际航段'; COMMENT ON COLUMN ods_flight_schedule.std IS '计划起飞时间，业务增量游标'; COMMENT ON COLUMN ods_flight_schedule.sta IS '计划到达时间'; COMMENT ON COLUMN ods_flight_schedule.atd IS '实际起飞时间'; COMMENT ON COLUMN ods_flight_schedule.flight_status IS '航班状态'; COMMENT ON COLUMN ods_flight_schedule.delay_code_raw IS '源系统延误原因代码'; COMMENT ON COLUMN ods_flight_schedule.delay_minutes IS '延误分钟'; COMMENT ON COLUMN ods_flight_schedule.tail_no IS '执飞航空器机尾号，关联ods_aircraft_tail'; COMMENT ON COLUMN ods_flight_schedule.carrier_code IS '承运人代码'; COMMENT ON COLUMN ods_flight_schedule.updated_at IS '接入更新时间/技术增量游标';
COMMENT ON COLUMN ods_flight_schedule.record_source IS '记录来源：MANUAL或AVIATIONSTACK'; COMMENT ON COLUMN ods_flight_schedule.source_record_id IS '来源系统内稳定记录标识'; COMMENT ON COLUMN ods_flight_schedule.business_key IS '跨来源航班业务键'; COMMENT ON COLUMN ods_flight_schedule.source_updated_at IS '来源记录更新时间'; COMMENT ON COLUMN ods_flight_schedule.ingested_at IS '平台接入时间'; COMMENT ON COLUMN ods_flight_schedule.raw_payload IS 'API原始记录JSON，手工记录为空';

COMMENT ON COLUMN ods_china_airport_current_weather.airport_icao IS '机场ICAO，业务主键'; COMMENT ON COLUMN ods_china_airport_current_weather.airport_name IS '机场名称'; COMMENT ON COLUMN ods_china_airport_current_weather.municipality IS '所在城市'; COMMENT ON COLUMN ods_china_airport_current_weather.iso_region IS 'ISO行政区'; COMMENT ON COLUMN ods_china_airport_current_weather.airport_type IS '机场类型'; COMMENT ON COLUMN ods_china_airport_current_weather.scheduled_service IS '是否有定期航班'; COMMENT ON COLUMN ods_china_airport_current_weather.latitude IS '机场目录纬度'; COMMENT ON COLUMN ods_china_airport_current_weather.longitude IS '机场目录经度'; COMMENT ON COLUMN ods_china_airport_current_weather.report_status IS 'CURRENT_REPORT或NO_CURRENT_REPORT'; COMMENT ON COLUMN ods_china_airport_current_weather.observe_time IS 'METAR观测时间'; COMMENT ON COLUMN ods_china_airport_current_weather.report_type IS '报文类型'; COMMENT ON COLUMN ods_china_airport_current_weather.raw_report IS '原始METAR报文'; COMMENT ON COLUMN ods_china_airport_current_weather.temperature_c IS '温度摄氏度'; COMMENT ON COLUMN ods_china_airport_current_weather.dewpoint_c IS '露点摄氏度'; COMMENT ON COLUMN ods_china_airport_current_weather.wind_direction_deg IS '风向原始值，可为角度或VRB'; COMMENT ON COLUMN ods_china_airport_current_weather.wind_speed_kt IS '风速节'; COMMENT ON COLUMN ods_china_airport_current_weather.wind_gust_kt IS '阵风节'; COMMENT ON COLUMN ods_china_airport_current_weather.visibility_raw IS '原始能见度，可含加号'; COMMENT ON COLUMN ods_china_airport_current_weather.altimeter IS '高度表气压'; COMMENT ON COLUMN ods_china_airport_current_weather.flight_category IS 'VFR/MVFR/IFR/LIFR'; COMMENT ON COLUMN ods_china_airport_current_weather.metar_latitude IS 'METAR站点纬度'; COMMENT ON COLUMN ods_china_airport_current_weather.metar_longitude IS 'METAR站点经度'; COMMENT ON COLUMN ods_china_airport_current_weather.elevation_m IS '站点海拔米'; COMMENT ON COLUMN ods_china_airport_current_weather.metar_station_name IS 'METAR站点名称'; COMMENT ON COLUMN ods_china_airport_current_weather.last_fetched_at IS '最后抓取时间/增量游标';

COMMENT ON COLUMN stg_aviationweather_current_metar.airport_icao IS '机场ICAO，当前快照主键'; COMMENT ON COLUMN stg_aviationweather_current_metar.observe_time IS 'METAR观测时间'; COMMENT ON COLUMN stg_aviationweather_current_metar.report_type IS '报文类型'; COMMENT ON COLUMN stg_aviationweather_current_metar.raw_report IS '原始METAR报文'; COMMENT ON COLUMN stg_aviationweather_current_metar.temperature_c IS '温度原始值'; COMMENT ON COLUMN stg_aviationweather_current_metar.dewpoint_c IS '露点原始值'; COMMENT ON COLUMN stg_aviationweather_current_metar.wind_direction_deg IS '风向原始值，可为角度或VRB'; COMMENT ON COLUMN stg_aviationweather_current_metar.wind_speed_kt IS '风速原始值'; COMMENT ON COLUMN stg_aviationweather_current_metar.wind_gust_kt IS '阵风原始值'; COMMENT ON COLUMN stg_aviationweather_current_metar.visibility_raw IS '能见度原始值'; COMMENT ON COLUMN stg_aviationweather_current_metar.altimeter IS '高度表气压原始值'; COMMENT ON COLUMN stg_aviationweather_current_metar.flight_category IS '飞行规则类别'; COMMENT ON COLUMN stg_aviationweather_current_metar.latitude IS '站点纬度原始值'; COMMENT ON COLUMN stg_aviationweather_current_metar.longitude IS '站点经度原始值'; COMMENT ON COLUMN stg_aviationweather_current_metar.elevation_m IS '站点海拔原始值'; COMMENT ON COLUMN stg_aviationweather_current_metar.station_name IS '站点名称'; COMMENT ON COLUMN stg_aviationweather_current_metar.last_fetched_at IS '最后抓取时间/增量游标';

COMMIT;
