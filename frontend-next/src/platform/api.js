// Todo lo que va al backend pasa por aquí. Es el MISMO backend y la MISMA
// base de datos que la Puchi actual (ver la Issue de decisión del repo): los
// datos que se ven aquí son reales. Regla mientras convivan las dos: los
// endpoints que ya usa la Puchi actual no se tocan ni se cambian de forma;
// lo que necesite otra respuesta se añade como endpoint nuevo.
export async function api(path, { method = 'GET', body, headers, ...rest } = {}) {
  const isForm = body instanceof FormData
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: {
      ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
    ...rest,
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    throw Object.assign(new Error(detail.detail || `Error ${res.status}`), { status: res.status })
  }
  return res.status === 204 ? null : res.json()
}
