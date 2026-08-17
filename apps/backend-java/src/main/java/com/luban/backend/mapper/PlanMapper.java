package com.luban.backend.mapper;

import com.luban.backend.entity.Plan;
import org.apache.ibatis.annotations.*;

import java.util.List;

@Mapper
public interface PlanMapper {

    /** gates AS gates_json：列名对齐实体属性 gatesJson（map-underscore-to-camel-case），否则读取恒为 null。 */
    String COLS = "plan_code, name, status, price_monthly, quota_leads, quota_pages, quota_visits, gates AS gates_json, trial_days, sort_order";

    /** 列表仅 visible（hidden 供 e2e fixture，不影响 getByCode 订阅校验）。 */
    @Select("SELECT " + COLS + " FROM plans WHERE status = 'visible' ORDER BY sort_order")
    List<Plan> listVisible();

    @Select("SELECT " + COLS + " FROM plans WHERE plan_code = #{planCode}")
    Plan getByCode(String planCode);

    @Insert("INSERT INTO plans (plan_code, name, status, price_monthly, quota_leads, quota_pages, quota_visits, gates, trial_days, sort_order) " +
            "VALUES (#{planCode}, #{name}, #{status}, #{priceMonthly}, #{quotaLeads}, #{quotaPages}, #{quotaVisits}, #{gatesJson}, #{trialDays}, #{sortOrder})")
    int insert(Plan plan);
}
