package com.luban.backend.service;

import com.luban.backend.entity.Plan;
import com.luban.backend.mapper.PlanMapper;
import org.springframework.stereotype.Service;

import java.util.List;

/** 套餐查询（T-be-3）：列表仅返回 visible 档（hidden 供 e2e fixture，不影响订阅校验）。 */
@Service
public class PlanService {

    private final PlanMapper planMapper;

    public PlanService(PlanMapper planMapper) {
        this.planMapper = planMapper;
    }

    public List<Plan> listVisible() {
        return planMapper.listVisible();
    }

    public Plan getByCode(String planCode) {
        return planMapper.getByCode(planCode);
    }
}
