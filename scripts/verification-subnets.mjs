// Disposable verification networks only; preserve unrelated Docker networks.
export function verificationSubnets(occupied, count = 2) {
  const integer = ip => ip.split('.').map(Number).reduce((n, octet) => n * 256 + octet, 0)
  const ranges = occupied.map(cidr => {
    const [address, prefix] = cidr.split('/')
    const size = 2 ** (32 - Number(prefix))
    const start = Math.floor(integer(address) / size) * size
    return [start, start + size - 1]
  })
  const selected = []
  for (let n = 0; n < 256 && selected.length < count; n++) {
    const start = integer(`10.240.${n}.0`)
    if (ranges.every(([low, high]) => start + 255 < low || start > high)) selected.push(`10.240.${n}.0/24`)
  }
  if (selected.length !== count) throw new Error('No isolated verification subnets available')
  return selected
}
