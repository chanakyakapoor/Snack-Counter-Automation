/** Chat: direct(employeeId, text), channel(officeId, text), admin(officeId, text, actions?). */
export function fakeChat() {
  const messages = [];
  return {
    messages,
    direct: (employeeId, text) =>
      messages.push({ type: "direct", employeeId, text }),
    channel: (officeId, text) =>
      messages.push({ type: "channel", officeId, text }),
    admin: (officeId, text, actions = []) =>
      messages.push({ type: "admin", officeId, text, actions }),
  };
}
