package com.luban.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.time.Clock;

/**
 * 定时任务装配（T-be-7）。全仓首个 @EnableScheduling（此前无定时任务）。
 * Clock 以 bean 提供：TrialDowngradeJob 时间可注入，测试用 Clock.fixed 断言到期判定。
 */
@Configuration
@EnableScheduling
public class SchedulingConfig {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
