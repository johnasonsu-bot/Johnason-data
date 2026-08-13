-- 航空本体字段级血缘元数据（PostgreSQL / ods）
-- 该脚本只登记可审计的概念字段映射，不覆盖 ODS 原始数据；可重复执行。

BEGIN;

CREATE TABLE IF NOT EXISTS meta_ontology_field_lineage (
  concept_name varchar(64) NOT NULL,
  concept_field varchar(128) NOT NULL,
  source_table varchar(128) NOT NULL,
  source_field varchar(128) NOT NULL,
  target_view varchar(128) NOT NULL,
  target_field varchar(128) NOT NULL,
  transform_rule varchar(512) NOT NULL,
  key_role varchar(32) NOT NULL,
  evidence_ref varchar(128) NOT NULL DEFAULT 'aviation_ontology_field_lineage.json',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (concept_name, concept_field, source_table, source_field, target_view, target_field)
);

INSERT INTO meta_ontology_field_lineage
  (concept_name, concept_field, source_table, source_field, target_view, target_field, transform_rule, key_role)
VALUES
 ('FlightSegment','entity_id','ods_flight_schedule','flight_segment_id','dwd_ent_flight_segment','entity_id','direct','PK'),
 ('FlightSegment','flight_no','ods_flight_schedule','flight_no','dwd_ent_flight_segment','flight_no','direct','BUSINESS_ATTRIBUTE'),
 ('FlightSegment','dep_airport','ods_flight_schedule','dep_airport','dwd_ent_flight_segment','dep_airport','direct ICAO','JOIN_KEY'),
 ('FlightSegment','arr_airport','ods_flight_schedule','arr_airport','dwd_ent_flight_segment','arr_airport','direct ICAO','JOIN_KEY'),
 ('FlightSegment','std','ods_flight_schedule','std','dwd_ent_flight_segment','std','direct; incremental cursor','INCREMENTAL_CURSOR'),
 ('FlightSegment','sta','ods_flight_schedule','sta','dwd_ent_flight_segment','sta','direct','BUSINESS_ATTRIBUTE'),
 ('FlightSegment','atd','ods_flight_schedule','atd','dwd_ent_flight_segment','atd','direct; nullable until departure','BUSINESS_ATTRIBUTE'),
 ('FlightSegment','flight_status','ods_flight_schedule','flight_status','dwd_ent_flight_segment','flight_status','direct','BUSINESS_ATTRIBUTE'),
 ('FlightSegment','delay_minutes','ods_flight_schedule','delay_minutes','dwd_ent_flight_segment','delay_minutes','safe numeric cast; blank -> null','RULE_INPUT'),
 ('FlightSegment','delay_code_raw','ods_flight_schedule','delay_code_raw','dwd_ent_flight_segment','delay_code_raw','direct source evidence','RULE_INPUT'),
 ('FlightSegment','delay_code_std','dim_delay_code_coda','coda_code','dwd_ent_flight_segment','delay_code_std','left join raw_code = COALESCE(delay_code_raw,'''')','DICTIONARY_OUTPUT'),
 ('FlightSegment','delay_category_cn','dim_delay_code_coda','category_cn','dwd_ent_flight_segment','delay_category_cn','left join CODA dictionary','DICTIONARY_OUTPUT'),
 ('FlightSegment','tail_no','ods_flight_schedule','tail_no','dwd_ent_flight_segment','tail_no','direct; nullable for API records','RELATION_KEY'),
 ('FlightSegment','carrier_code','ods_flight_schedule','carrier_code','dwd_ent_flight_segment','carrier_code','direct; Aviationstack source constrained to CZ','QUALITY_INPUT'),
 ('AircraftTail','entity_id','ods_aircraft_tail','tail_no','dwd_ent_aircraft_tail','entity_id','direct','PK'),
 ('AircraftTail','aircraft_model','ods_aircraft_tail','aircraft_model','dwd_ent_aircraft_tail','aircraft_model','direct','BUSINESS_ATTRIBUTE'),
 ('AircraftTail','cabin_class','ods_aircraft_tail','cabin_class','dwd_ent_aircraft_tail','cabin_class','direct','BUSINESS_ATTRIBUTE'),
 ('AircraftTail','remain_flight_hours','ods_aircraft_tail','remain_flight_hours','dwd_ent_aircraft_tail','remain_flight_hours','safe numeric cast','QUALITY_INPUT'),
 ('AircraftTail','has_mel_defect','ods_aircraft_tail','mel_defect','dwd_ent_aircraft_tail','has_mel_defect','CASE blank -> 0 else 1','RULE_INPUT'),
 ('AircraftTail','current_station','ods_aircraft_tail','current_station','dwd_ent_aircraft_tail','current_station','direct ICAO','BUSINESS_ATTRIBUTE'),
 ('AircraftTail','tail_status','ods_aircraft_tail','tail_status','dwd_ent_aircraft_tail','tail_status','direct','RULE_INPUT'),
 ('CrewMember','entity_id','ods_crew_roster','crew_id','dwd_ent_crew_member','entity_id','direct','PK'),
 ('CrewMember','crew_role','ods_crew_roster','crew_role','dwd_ent_crew_member','crew_role','direct','BUSINESS_ATTRIBUTE'),
 ('CrewMember','qualified_model','ods_crew_roster','qualified_model','dwd_ent_crew_member','qualified_model','direct','JOIN_ATTRIBUTE'),
 ('CrewMember','duty_start','ods_crew_roster','duty_start','dwd_ent_crew_member','duty_start','direct datetime','TIME_ATTRIBUTE'),
 ('CrewMember','duty_hours','ods_crew_roster','duty_hours','dwd_ent_crew_member','duty_hours','safe numeric cast','RULE_INPUT'),
 ('CrewMember','duty_limit_hours','ods_crew_roster','duty_limit_hours','dwd_ent_crew_member','duty_limit_hours','safe numeric cast; default policy 13','RULE_INPUT'),
 ('CrewMember','rest_hours','ods_crew_roster','rest_hours','dwd_ent_crew_member','rest_hours','safe numeric cast','RULE_INPUT'),
 ('CrewMember','rest_min_hours','ods_crew_roster','rest_min_hours','dwd_ent_crew_member','rest_min_hours','safe numeric cast; default policy 10','RULE_INPUT'),
 ('CrewMember','assigned_flight_no','ods_crew_roster','assigned_flight_no','dwd_ent_crew_member','assigned_flight_no','direct','RELATION_KEY'),
 ('CrewMember','compliance_flag','ods_crew_roster','compliance_flag','dwd_ent_crew_member','compliance_flag','direct evidence; recomputed by rule view','QUALITY_OUTPUT'),
 ('WeatherEvent','entity_id','ods_weather_metar','airport_icao','dwd_ent_weather_event','entity_id','concat airport_icao || ''#'' || observe_time','COMPOSITE_PK'),
 ('WeatherEvent','airport_icao','ods_weather_metar','airport_icao','dwd_ent_weather_event','airport_icao','direct ICAO','JOIN_KEY'),
 ('WeatherEvent','observe_time','ods_weather_metar','observe_time','dwd_ent_weather_event','observe_time','direct datetime','COMPOSITE_PK'),
 ('WeatherEvent','weather_phenomenon','ods_weather_metar','weather_phenomenon','dwd_ent_weather_event','weather_phenomenon','direct normalized text','RULE_INPUT'),
 ('WeatherEvent','visibility_m','ods_weather_metar','visibility_m','dwd_ent_weather_event','visibility_m','safe numeric cast from raw visibility','RULE_INPUT'),
 ('WeatherEvent','wind_gust_kt','ods_weather_metar','wind_gust_kt','dwd_ent_weather_event','wind_gust_kt','safe numeric cast; VRB stays in raw field','RULE_INPUT'),
 ('WeatherEvent','severity_level','ods_weather_metar','severity_level','dwd_ent_weather_event','severity_level','direct; filter SEVERE','RULE_INPUT'),
 ('WeatherEvent','flight_category','ods_china_airport_current_weather','flight_category','dwd_ent_weather_event','flight_category','fallback current-weather snapshot','QUALITY_INPUT'),
 ('RunwayCapacity','entity_id','ods_runway_slot','airport_icao','dwd_ent_runway_capacity','entity_id','concat airport_icao || ''#'' || runway_id || ''#'' || slot_hour','COMPOSITE_PK'),
 ('RunwayCapacity','airport_icao','ods_runway_slot','airport_icao','dwd_ent_runway_capacity','airport_icao','direct ICAO','JOIN_KEY'),
 ('RunwayCapacity','runway_id','ods_runway_slot','runway_id','dwd_ent_runway_capacity','runway_id','direct','COMPOSITE_PK'),
 ('RunwayCapacity','slot_hour','ods_runway_slot','slot_hour','dwd_ent_runway_capacity','slot_hour','direct hour bucket','COMPOSITE_PK'),
 ('RunwayCapacity','declared_capacity','ods_runway_slot','declared_capacity','dwd_ent_runway_capacity','declared_capacity','NULLIF blank then numeric','RULE_INPUT'),
 ('RunwayCapacity','available_capacity','ods_runway_slot','available_capacity','dwd_ent_runway_capacity','available_capacity','NULLIF blank then numeric','RULE_INPUT'),
 ('RunwayCapacity','capacity_ratio','ods_runway_slot','capacity_ratio','dwd_ent_runway_capacity','capacity_ratio','NULLIF blank then numeric; 0..1 quality rule','RULE_INPUT'),
 ('RunwayCapacity','restriction_reason','ods_runway_slot','restriction_reason','dwd_ent_runway_capacity','restriction_reason','direct','RULE_INPUT')
ON CONFLICT (concept_name, concept_field, source_table, source_field, target_view, target_field)
DO UPDATE SET transform_rule=excluded.transform_rule,key_role=excluded.key_role,updated_at=now();

CREATE OR REPLACE VIEW dwd_ontology_field_lineage AS
SELECT concept_name,concept_field,source_table,source_field,target_view,target_field,transform_rule,key_role,evidence_ref,updated_at
FROM meta_ontology_field_lineage;

CREATE OR REPLACE VIEW dwd_ontology_relation_lineage AS
SELECT * FROM (VALUES
  ('operatedBy','FlightSegment','AircraftTail','ods_flight_schedule.tail_no','ods_aircraft_tail.tail_no','dwd_rel_flight_operated_by_tail','source tail_no = target tail_no'),
  ('staffedBy','FlightSegment','CrewMember','ods_flight_schedule.flight_no','ods_crew_roster.assigned_flight_no','dwd_rel_flight_staffed_by_crew','same flight number and operating window'),
  ('impacts','WeatherEvent','FlightSegment','ods_weather_metar.airport_icao#observe_time','ods_flight_schedule.dep_airport#std','dwd_rel_weather_impacts_flight','airport matches and observe hour overlaps planned departure hour')
) AS relation_lineage(relation_name,source_concept,target_concept,source_field,target_field,relation_view,join_condition);

CREATE OR REPLACE VIEW dwd_ontology_rule_lineage AS
SELECT * FROM (VALUES
  ('SWRL-WEATHER-DELAY','dwd_rel_weather_impacts_flight.weather_phenomenon + dwd_ent_flight_segment.delay_minutes','dwd_rule_weather_delay_inferred.inferred_class','WeatherDelayedFlight'),
  ('SHACL-CREW-DUTY','dwd_rel_flight_staffed_by_crew.duty_hours/duty_limit_hours/rest_hours/rest_min_hours','dwd_rule_crew_duty_violation.violation_type','DUTY_OVER_LIMIT or REST_UNDER_MIN')
) AS rule_lineage(rule_code,input_fields,output_field,semantic_result);

COMMENT ON TABLE meta_ontology_field_lineage IS '航空本体概念字段到 DWD/ODS 字段级血缘登记；与航空本体知识库和动态图谱同源';
COMMENT ON VIEW dwd_ontology_field_lineage IS '航空本体字段级血缘查询视图';
COMMENT ON VIEW dwd_ontology_relation_lineage IS '航空本体三类关系的字段级连接证据';
COMMENT ON VIEW dwd_ontology_rule_lineage IS '航空本体规则输入输出字段血缘';

COMMIT;
