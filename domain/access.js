/** Authorization is by explicit Firebase UID, never by email domain/provider. */
export function isAdministrator(uid, config) {
  return typeof uid === "string" && uid.length > 0 &&
    [config.adminUid, ...(config.additionalAdminUids || [])].includes(uid);
}
