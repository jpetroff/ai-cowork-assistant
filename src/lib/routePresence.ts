let currentPathname = ''

export function setCurrentRoutePathname(pathname: string) {
  currentPathname = pathname
}

export function isViewingChatRoute(projectId: string, conversationId: string) {
  return currentPathname === `/projects/${projectId}/chats/${conversationId}`
}
