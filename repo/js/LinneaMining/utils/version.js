function checkVersion(version, minVersion = '0.60.2') {
  const normalizeVersion = (v) => {
    const match = String(v).match(/^(\d+\.\d+\.\d+)/)
    return match ? match[1] : '0.0.0'
  }

  const currentParts = normalizeVersion(version).split('.').map(Number)
  const minParts = normalizeVersion(minVersion).split('.').map(Number)

  const maxLength = Math.max(currentParts.length, minParts.length)

  while (currentParts.length < maxLength) currentParts.push(0)
  while (minParts.length < maxLength) minParts.push(0)

  for (let i = 0; i < maxLength; i++) {
    if (currentParts[i] > minParts[i]) return true
    if (currentParts[i] < minParts[i]) return false
  }

  return true
}

export { checkVersion };
