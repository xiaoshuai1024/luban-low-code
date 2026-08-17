package com.luban.backend.dto;

/**
 * 公开分流响应（GET /public/ab/assign）。
 * running 且已分桶：variantId/variantKey 非空；
 * experiment 已 ended：variantId/variantKey 为 null 且 status='ended'（design D2）。
 */
public record AbAssignResponse(String experimentId, String variantId, String variantKey, String status) {

    public static AbAssignResponse ended(String experimentId) {
        return new AbAssignResponse(experimentId, null, null, "ended");
    }
}
