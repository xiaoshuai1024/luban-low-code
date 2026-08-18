package com.luban.backend.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<APIError> handleBusiness(BusinessException ex) {
        return ResponseEntity
                .status(ex.getHttpStatus())
                .body(new APIError(ex.getCode(), ex.getMessage(), ex.getDetails()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<APIError> handleValidation(MethodArgumentNotValidException ex) {
        String msg = ex.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(e -> e.getField() + ": " + e.getDefaultMessage())
                .orElse("请求参数非法");
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(new APIError("INVALID_ARGUMENT", msg));
    }

    /**
     * Malformed / unreadable JSON body (e.g. truncated payload, invalid JSON syntax).
     * Aligned with the Go backend's {@code ShouldBindJSON} failure path → 400
     * INVALID_ARGUMENT (plan §9.2). Without this handler Spring would fall through to
     * {@link #handleOther} and return 500 INTERNAL, breaking dual-backend parity.
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<APIError> handleUnreadable(HttpMessageNotReadableException ex) {
        String msg = ex.getMessage() != null && ex.getMessage().contains("required")
                ? "request body is required"
                : "malformed JSON body";
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(new APIError("INVALID_ARGUMENT", msg));
    }

    /**
     * DB 完整性冲突（约束/唯一键等，未被业务层收敛的）：500 通用文案，
     * SQL/约束细节仅记服务端日志（log.warn 含根因），不返回客户端。
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<APIError> handleDataIntegrity(DataIntegrityViolationException ex) {
        log.warn("data integrity violation: {}", ex.getMostSpecificCause().getMessage(), ex);
        return internalError();
    }

    /**
     * 兜底 500：响应统一通用文案（不泄露 ex.getMessage() 中的内部细节，如 SQL/路径），
     * 完整堆栈仅在服务端日志保留。
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<APIError> handleOther(Exception ex) {
        log.error("unhandled exception", ex);
        return internalError();
    }

    private static ResponseEntity<APIError> internalError() {
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new APIError("INTERNAL", "服务器内部错误"));
    }
}
