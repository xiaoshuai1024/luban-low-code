import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosError } from 'axios';
import { getToken, refreshToken } from '../auth.js';

const BFF_BASE_URL = process.env.BFF_BASE_URL || 'http://localhost:3001';

let client: AxiosInstance | null = null;

/** Create or return the singleton axios client with auth interceptors. */
function getClient(): AxiosInstance {
  if (!client) {
    client = axios.create({
      baseURL: BFF_BASE_URL,
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });

    // Inject Authorization header on every outgoing request
    client.interceptors.request.use((config) => {
      const token = getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Handle 401 responses by attempting token refresh, then retry once
    client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

        // Only attempt refresh once per request
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            await refreshToken();
            const newToken = getToken();
            if (newToken && originalRequest.headers) {
              (originalRequest.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
            }
            return (await client!.request(originalRequest)).data;
          } catch (refreshError) {
            // If refresh also fails, throw the original 401 error
            throw toBffError(error);
          }
        }

        throw toBffError(error);
      },
    );
  }
  return client;
}

/** Error with BFF code and HTTP status attached. */
export interface BffError extends Error {
  code: number;
  status?: number;
}

function toBffError(error: AxiosError): BffError {
  const data = error.response?.data as { code?: number; message?: string } | undefined;
  const bffErr = new Error(
    data?.message || `BFF request failed: ${error.message}`,
  ) as BffError;
  bffErr.name = 'BffError';
  bffErr.code = data?.code ?? error.response?.status ?? 0;
  bffErr.status = error.response?.status;
  return bffErr;
}

/**
 * Make an authenticated request to the BFF API.
 *
 * - JWT is automatically injected from the cached token.
 * - On 401, triggers JWT auto-refresh and retries the request once.
 * - BFF error responses are passed through with `code` and `message`.
 *
 * @param method  HTTP method (GET, POST, PUT, DELETE, etc.)
 * @param path    API path, e.g. "/api/pages"
 * @param data    Request body (for POST/PUT/PATCH)
 * @param config  Additional axios request config overrides
 * @returns       Response data typed as T
 */
export async function callBff<T = unknown>(
  method: string,
  path: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await getClient().request<T>({
    method: method as AxiosRequestConfig['method'],
    url: path,
    data,
    ...config,
  });
  return response.data;
}
