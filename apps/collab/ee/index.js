// Own collab plugin: real-time boards (`board:{board_uuid}` rooms), written for the St. Joseph's deployment.
// Access and state live in the API (ee/routers/boards): GET /boards/{uuid}/membership (Bearer), GET|PUT /boards/{uuid}/ydoc (internal key).

const SEATS = { editors: 10, viewers: 50, noun: 'Board' }
const COLORS = ['#e11d48', '#7c3aed', '#0284c7', '#059669', '#d97706', '#db2777', '#4f46e5', '#0d9488']
const colorFor = (id) => COLORS[Math.abs(typeof id === 'number' ? id : [...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0)) % COLORS.length]
const finite = (v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e7

function parse(documentName) {
  const m = /^board:([A-Za-z0-9_-]{8,80})$/.exec(documentName)
  return m ? m[1] : null
}

function presenceUser(connection) {
  const u = connection.context?.user ?? {}
  return {
    id: typeof u.id === 'number' ? u.id : 0,
    name: typeof u.name === 'string' && u.name ? u.name : 'Unknown',
    color: typeof u.color === 'string' ? u.color : '#64748b',
    avatar: typeof u.avatar === 'string' ? u.avatar : null,
    uuid: typeof u.uuid === 'string' ? u.uuid : null,
  }
}

// Identity is forced from the connection; only a pointer position and two UI flags are relayed.
function sanitize(connection, states, removedClients, claims, live) {
  const ownedByOther = (id) => {
    const owner = claims.get(id)
    return owner !== undefined && owner !== connection && live.includes(owner)
  }
  const user = presenceUser(connection)
  for (const [clientId, state] of states) {
    if (ownedByOther(clientId)) { states.delete(clientId); continue }
    claims.set(clientId, connection)
    const clean = { user: { ...user } }
    const c = state?.cursor
    if (c && typeof c === 'object' && finite(c.x) && finite(c.y)) clean.cursor = { x: c.x, y: c.y }
    for (const flag of ['idle', 'typing']) if (typeof state?.[flag] === 'boolean') clean[flag] = state[flag]
    states.set(clientId, clean)
  }
  for (const clientId of [...removedClients]) {
    if (ownedByOther(clientId)) removedClients.delete(clientId)
    else claims.delete(clientId)
  }
}

export default function register(deps) {
  const { apiUrl, internalKey, fetchWithTimeout, maxYdocBytes } = deps
  const base = (uuid) => `${apiUrl}/api/v1/boards/${uuid}`
  const membership = (uuid, token) => fetchWithTimeout(`${base(uuid)}/membership`, { headers: { Authorization: `Bearer ${token}` } })

  const kind = {
    name: 'board',
    parse,
    seats: SEATS,
    presence: { sanitize },
    tooLargeReason: 'Board is too large',
    fetchAccess: membership,

    async authorize(uuid, token, tokenUserId) {
      let response
      try { response = await membership(uuid, token) } catch (err) {
        console.error(`[collab] Board access check failed for ${uuid}:`, err)
        throw new Error('Authentication service unavailable')
      }
      if (!response.ok) throw new Error('Not authorized for this board')
      const access = await response.json()
      const id = Number(tokenUserId)
      return {
        readOnly: access.role === 'viewer',
        user: {
          id: Number.isFinite(id) ? id : String(tokenUserId),
          name: access.username || 'Unknown',
          color: colorFor(tokenUserId),
          avatar: access.avatar_image || null,
          uuid: access.user_uuid || null,
          role: access.role,
        },
      }
    },

    async fetch(uuid) {
      try {
        const response = await fetchWithTimeout(`${base(uuid)}/ydoc`, { headers: { 'X-Internal-Key': internalKey } })
        if (!response.ok) { console.error(`[collab] Failed to fetch board ${uuid}: ${response.status}`); return null }
        const buffer = await response.arrayBuffer()
        return buffer.byteLength ? new Uint8Array(buffer) : null
      } catch (err) { console.error(`[collab] Error fetching board ${uuid}:`, err); return null }
    },

    async store(uuid, state) {
      if (state.byteLength > maxYdocBytes) { console.warn(`[collab] Refusing to persist board ${uuid}: ${state.byteLength} bytes`); return }
      try {
        const response = await fetchWithTimeout(`${base(uuid)}/ydoc`, {
          method: 'PUT',
          headers: { 'X-Internal-Key': internalKey, 'Content-Type': 'application/octet-stream' },
          body: state.buffer.slice(state.byteOffset, state.byteOffset + state.byteLength),
        })
        if (!response.ok) console.error(`[collab] Board store failed for ${uuid}: ${response.status}`)
      } catch (err) { console.error(`[collab] Board store error for ${uuid}:`, err) }
    },
  }

  return { name: 'st-josephs-boards', kinds: [kind] }
}
