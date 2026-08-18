package com.luban.backend.contract;

import com.luban.backend.config.DemoAccountInitializer;
import com.luban.backend.mapper.UserMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * T-be-8：DemoAccountInitializer 条件装配行为锁定。
 *
 *  - app.demo-account.enabled=true → bean 加载（dev compose 显式开启，matchIfMissing=false）；
 *  - =false / 未配置 → bean 不加载（默认关闭：安全缺省，生产/未知环境无内置体验账号）；
 *  - 默认 test profile 下 ApplicationRunner 不执行：users 表无 test 账号。
 *
 * 装配矩阵用 ApplicationContextRunner 切片验证（不触发 ApplicationRunner、不污染共享 H2）；
 * 行为验证用完整 @SpringBootTest。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DemoAccountInitializerConditionalTest {

    @Autowired private JdbcTemplate jdbc;

    /** 最小依赖切片：DemoAccountInitializer 仅需 UserMapper + PasswordEncoder。 */
    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withBean(UserMapper.class, () -> Mockito.mock(UserMapper.class))
            .withBean(PasswordEncoder.class, BCryptPasswordEncoder::new)
            .withUserConfiguration(DemoAccountInitializer.class);

    @Test
    void disabledPropertyHidesInitializerBean() {
        runner.withPropertyValues("app.demo-account.enabled=false")
                .run(ctx -> assertThat(ctx).doesNotHaveBean(DemoAccountInitializer.class));
    }

    @Test
    void enabledPropertyLoadsInitializerBean() {
        runner.withPropertyValues("app.demo-account.enabled=true")
                .run(ctx -> assertThat(ctx).hasSingleBean(DemoAccountInitializer.class));
    }

    @Test
    void missingPropertyDefaultsToDisabled() {
        runner.run(ctx -> assertThat(ctx).doesNotHaveBean(DemoAccountInitializer.class));
    }

    /** 行为锁：默认（test profile 走 application.yml 缺省 false）时启动不创建 test 体验账号。 */
    @Test
    void defaultProfileDoesNotCreateDemoAccount() {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM users WHERE username = 'test' AND role = 'user' AND status = 'active'",
                Integer.class);
        assertThat(count).isZero();
    }
}

/**
 * enabled=true 行为锁（T-be-8 补充）：ApplicationRunner 真实执行——
 * 体验账号恰好 1 个（role=user/status=active），且 test/test 可登录（200）。
 *
 * 独立 Spring context（properties 差异触发新缓存键），H2 为同名共享库
 * （DB_CLOSE_DELAY=-1）：用后删除 test 账号，避免污染默认 context 的
 * 「不创建」断言（users 被 subscriptions/orders/trial_records ON DELETE CASCADE 引用）。
 */
@SpringBootTest(properties = "app.demo-account.enabled=true")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DemoAccountInitializerEnabledContractTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;

    @AfterEach
    void cleanupSharedH2() {
        jdbc.update("DELETE FROM users WHERE username = 'test'");
    }

    @Test
    void enabledPropertyCreatesSingleActiveDemoAccountWhichCanLogin() throws Exception {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM users WHERE username = 'test' AND role = 'user' AND status = 'active'",
                Integer.class);
        assertThat(count).isEqualTo(1);

        mockMvc.perform(post("/backend/auth/login")
                        .contextPath("/backend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"test\",\"password\":\"test\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.username").value("test"))
                .andExpect(jsonPath("$.user.role").value("user"));
    }
}
