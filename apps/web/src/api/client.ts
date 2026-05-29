export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:6001";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {})
      }
    });
  } catch (error) {
    throw new Error(
      `백엔드 서버에 연결하지 못했습니다. ${API_BASE_URL} 서버가 꺼졌거나 다시 시작 중일 수 있습니다.`,
      {
        cause: error
      }
    );
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
