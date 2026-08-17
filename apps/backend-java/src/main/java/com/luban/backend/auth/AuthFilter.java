package com.luban.backend.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.luban.backend.exception.APIError;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Sets UserContext from X-User-ID / X-User-Role; enforces RequireUser and RequireAdmin by path.
 * Aligned with luban-backend-go middleware.
 *
 * <p>Internal shared secret: when {@code INTERNAL_AUTH_SECRET} is configured (prod/e2e),
 * non-public requests must carry a matching {@code X-Internal-Auth} header — otherwise
 * a client hitting the backend directly could forge X-User-ID/X-User-Role. When the
 * secret is NOT configured (local dev / unit tests) the filter fails open with a WARN.
 */
@Component
@Order(1)
public class AuthFilter implements Filter {

    private static final Logger log = LoggerFactory.getLogger(AuthFilter.class);

    private static final String HEADER_USER_ID = "X-User-ID";
    private static final String HEADER_USER_ROLE = "X-User-Role";
    private static final String HEADER_INTERNAL_AUTH = "X-Internal-Auth";
    // 注册三端点免鉴权（T-be-2）：BFF 侧 IP 限流 + 验证码 TTL/尝试上限/冷却三重防护兜底
    private static final Set<String> NO_AUTH_PATHS = Set.of(
            "/backend/ping", "/backend/healthz", "/backend/auth/login", "/backend/auth/api-key/validate",
            "/backend/auth/register", "/backend/auth/register/verify", "/backend/auth/register/resend");
    // T-be-6：/backend/sites 不再走 filter 级 admin 前置——POST /sites 放开给任意登录用户
    // （owner=self，quota_pages 限流），PUT/DELETE 的 owner/admin 判定下沉 SiteOwnershipGuard
    // （否则非 admin 的 owner 会被 filter 403 拦截，见 plan §9.1 T-be-6）。
    private static final Pattern ADMIN_USERS = Pattern.compile("^/backend/users(/.*)?$");
    private static final Pattern ADMIN_SETTINGS = Pattern.compile("^/backend/settings$");
    // /backend/leads/export — 明文 CSV 导出（解密 contact），仅 admin，防止任意用户导出任意站点线索。
    private static final Pattern ADMIN_LEADS_EXPORT = Pattern.compile("^/backend/leads/export$");
    // /backend/datasources, /backend/datasources/:id, /backend/datasources/:id/test — POST/PUT/DELETE require admin (GET is user-readable).
    // /test 会触发服务端连接探测（SSRF 面），也收紧为 admin。
    private static final Pattern ADMIN_DATASOURCES = Pattern.compile("^/backend/datasources(/[^/]+)?(/test)?$");

    private final ObjectMapper objectMapper = new ObjectMapper();

    /** BFF→backend 共享密钥；未配置时 fail-open（仅限本地 dev，生产 compose 强制注入）。 */
    private final String internalAuthSecret;
    private volatile boolean warnedNoSecret = false;

    public AuthFilter(@Value("${INTERNAL_AUTH_SECRET:}") String internalAuthSecret) {
        this.internalAuthSecret = internalAuthSecret != null ? internalAuthSecret.trim() : "";
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest req = (HttpServletRequest) request;
        HttpServletResponse res = (HttpServletResponse) response;
        String path = req.getRequestURI();
        String method = req.getMethod();

        try {
            String userId = req.getHeader(HEADER_USER_ID);
            String role = req.getHeader(HEADER_USER_ROLE);
            if (userId != null) userId = userId.trim();
            if (role != null) role = role.trim();
            UserContext.set(userId != null ? userId : "", role != null ? role : "");

            if (NO_AUTH_PATHS.contains(path) || path.startsWith("/backend/public/") || path.startsWith("/backend/lead/forms")) {
                chain.doFilter(request, response);
                return;
            }

            // 共享密钥校验：配置了 INTERNAL_AUTH_SECRET 时，非公开请求必须带匹配的 X-Internal-Auth，
            // 防止直连后端伪造 X-User-ID/X-User-Role；未配置时 fail-open（WARN 提示一次，仅限本地 dev）。
            if (!internalAuthSecret.isEmpty()) {
                String provided = req.getHeader(HEADER_INTERNAL_AUTH);
                if (provided == null || !MessageDigest.isEqual(
                        internalAuthSecret.getBytes(StandardCharsets.UTF_8),
                        provided.trim().getBytes(StandardCharsets.UTF_8))) {
                    writeError(res, HttpServletResponse.SC_UNAUTHORIZED, "UNAUTHENTICATED", "invalid internal auth");
                    return;
                }
            } else if (!warnedNoSecret) {
                warnedNoSecret = true;
                log.warn("INTERNAL_AUTH_SECRET 未配置，AuthFilter fail-open（仅限本地 dev；生产 compose 必须注入）");
            }

            if (userId == null || userId.isEmpty()) {
                writeError(res, HttpServletResponse.SC_UNAUTHORIZED, "UNAUTHENTICATED", "missing user");
                return;
            }

            if (requiresAdmin(path, method) && !UserContext.isAdmin()) {
                writeError(res, HttpServletResponse.SC_FORBIDDEN, "PERMISSION_DENIED", "admin only");
                return;
            }

            chain.doFilter(request, response);
        } finally {
            UserContext.clear();
        }
    }

    private boolean requiresAdmin(String path, String method) {
        if (ADMIN_USERS.matcher(path).matches() || ADMIN_SETTINGS.matcher(path).matches()) {
            return true;
        }
        // 线索明文 CSV 导出：仅 admin（原任意登录用户可导出任意站点，越权）。
        if (ADMIN_LEADS_EXPORT.matcher(path).matches()) {
            return true;
        }
        if (ADMIN_DATASOURCES.matcher(path).matches()) {
            // 含 /test：连接探测会从服务端发起出网请求（SSRF 面），同样仅 admin；GET 保持 RequireUser。
            return "POST".equals(method) || "PUT".equals(method) || "DELETE".equals(method);
        }
        return false;
    }

    private void writeError(HttpServletResponse res, int status, String code, String message) throws IOException {
        res.setStatus(status);
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        res.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(res.getOutputStream(), new APIError(code, message));
    }
}
