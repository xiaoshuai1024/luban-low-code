package com.luban.backend.service;

import com.luban.backend.auth.UserContext;
import com.luban.backend.entity.Site;
import com.luban.backend.exception.BusinessException;
import com.luban.backend.mapper.SiteMapper;
import org.springframework.stereotype.Service;

/**
 * 站点归属权限模型（T-be-6，plan §3.4 权限矩阵）：
 *
 *   写（update/delete/子资源 pages/forms/collections/leads 写入口）= owner 或 admin；
 *   owner_user_id = NULL（存量平台站点）仅 admin；
 *   GET /sites 非 admin 仅 owner=self（由 SiteService.list 过滤），单站读取走 assertVisible。
 *
 * AuthFilter 已收窄 ADMIN_SITES：PUT/DELETE 的 admin 前置下沉到这里判定（owner 非 admin
 * 不再被 filter 403 拦截），POST /sites 放开给任意登录用户（owner=self，受 quota_pages 限）。
 */
@Service
public class SiteOwnershipGuard {

    private final SiteMapper siteMapper;

    public SiteOwnershipGuard(SiteMapper siteMapper) {
        this.siteMapper = siteMapper;
    }

    /** 写入口守卫：owner 或 admin；owner=NULL 仅 admin。@return 站点实体（供配额按 owner 计）。 */
    public Site assertCanWrite(String siteId) {
        Site site = siteMapper.getById(siteId);
        if (site == null) {
            throw BusinessException.siteNotFound();
        }
        if (!UserContext.isAdmin()) {
            String owner = site.getOwnerUserId();
            String current = UserContext.getUserId();
            if (owner == null || current == null || !owner.equals(current)) {
                throw BusinessException.permissionDenied("仅站点所有者或管理员可操作此站点");
            }
        }
        return site;
    }

    /** 读入口守卫：与写同矩阵（S5 多租户隔离——他用户不可读非自有站点详情）。 */
    public Site assertVisible(String siteId) {
        Site site = siteMapper.getById(siteId);
        if (site == null) {
            throw BusinessException.siteNotFound();
        }
        if (!UserContext.isAdmin()) {
            String owner = site.getOwnerUserId();
            String current = UserContext.getUserId();
            if (owner == null || current == null || !owner.equals(current)) {
                throw BusinessException.permissionDenied("无权查看此站点");
            }
        }
        return site;
    }
}
