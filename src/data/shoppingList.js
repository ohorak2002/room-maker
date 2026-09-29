import { resolveItem } from './catalog'

/** Every placed item in the project: all rooms in home scope, else the open room. */
export function projectItems(store) {
  return store.scope === 'home' && store.home
    ? store.home.rooms.flatMap((r) => r.items || [])
    : store.items
}

export function projectTotals(store) {
  const items = projectItems(store)
  const total = items.reduce((sum, i) => {
    const item = resolveItem(i.id, store.synthetics)
    return sum + (item ? item.price * i.qty : 0)
  }, 0)
  const count = items.reduce((n, i) => n + i.qty, 0)
  return { total, count }
}

/**
 * Downloads the shopping list as JSON. This is an export, not a project file:
 * it cannot be reopened, and must never be treated as one.
 */
export function exportShoppingList(store) {
  const allItems = projectItems(store)
  const { total } = projectTotals(store)
  const lineFor = (i) => {
    const item = resolveItem(i.id, store.synthetics)
    return {
      name: item?.name,
      qty: i.qty,
      retailer: item?.retailerName,
      estimatedPrice: item?.price,
      link: item?.url,
    }
  }
  const payload = {
    exportedAt: new Date().toISOString(),
    palette: store.palette,
    mood: store.mood,
    lighting: store.lighting,
    floorplan: store.floorplan,
    windows: store.windows,
    scope: store.scope,
    home: store.home
      ? {
          beds: store.home.beds,
          baths: store.home.baths,
          sqft: store.home.sqft,
          storeys: store.home.storeys ?? 1,
          traced: Boolean(store.home.traced),
        }
      : null,
    // Room by room, not one merged list. The flat list was fine for a single
    // room and useless for a house: you could see you owned four lamps and
    // not which rooms they were in, which is the thing you need when you're
    // standing in the shop.
    rooms: store.home
      ? store.home.rooms
          .filter((r) => (r.items || []).length > 0)
          .map((r) => {
            const items = (r.items || []).map((i) => lineFor(i))
            return {
              name: r.name,
              kind: r.kind,
              floor: (r.floor ?? 0) + 1,
              sizeFt: `${(r.cols * 0.5 * 3.28084).toFixed(1)} x ${(r.rows * 0.5 * 3.28084).toFixed(1)}`,
              items,
              subtotal: items.reduce((s, i) => s + (i.estimatedPrice || 0) * i.qty, 0),
            }
          })
      : null,
    items: allItems.map((i) => lineFor(i)),
    estimatedTotal: total,
    note: 'Prices are estimates for prototyping, not live retail data.',
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  // Name it after what it is, so a folder of these stays readable.
  a.download = store.home
    ? `nested-${store.home.beds}bd-${store.home.sqft}sqft.json`
    : 'nested-room.json'
  a.click()
  URL.revokeObjectURL(a.href)
}
