export function errorText(error) {
    if (error && error.message) {
        return error.message;
    }
    return String(error);
}

export function formatPointNumber(number) {
    return String(number).padStart(2, "0");
}

export function baseName(path) {
    const normalized = String(path).replace(/\\/g, "/");
    return normalized.slice(normalized.lastIndexOf("/") + 1);
}

export function fileStem(path) {
    return baseName(path).replace(/\.json$/i, "");
}
