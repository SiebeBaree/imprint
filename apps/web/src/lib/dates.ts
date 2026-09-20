export function formatDate(date: string, options?: Intl.DateTimeFormatOptions) {
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC", ...options }).format(
        new Date(`${date}T12:00:00Z`),
    );
}
export function formatTime(time: string) {
    const [hours = "0", minutes = "00"] = time.split(":");
    const hour = Number(hours);
    return `${hour % 12 || 12}${minutes === "00" ? "" : `:${minutes}`} ${hour < 12 ? "AM" : "PM"}`;
}
export function today() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
