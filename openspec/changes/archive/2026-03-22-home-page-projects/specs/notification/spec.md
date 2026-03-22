# Spec: Notification

## ADDED Requirements

### Requirement: Global notification store provides a messaging bus
The system SHALL implement a standalone Zustand store (`notificationStore`) that any other store or module can call to push notifications. The store SHALL have no imports from any other application store, preventing circular dependencies.

#### Scenario: Push returns an ID
- **WHEN** any code calls `notificationStore.getState().push({ kind, message })`
- **THEN** a notification is added to the store and its auto-generated UUID is returned to the caller

#### Scenario: Dismiss by ID
- **WHEN** `notificationStore.getState().dismiss(id)` is called
- **THEN** only the notification with that ID is removed from the list

#### Scenario: Dismiss all
- **WHEN** `notificationStore.getState().dismissAll()` is called
- **THEN** all notifications are cleared

---

### Requirement: Notification toast stack is mounted in AppShell
The system SHALL render a `NotificationToast` component inside `AppShell` that persists across all route transitions. The stack SHALL display a maximum of 5 notifications at once.

#### Scenario: Toast visible after route change
- **WHEN** a notification is pushed and the user navigates to a different route
- **THEN** the toast remains visible until manually dismissed

#### Scenario: Stack capped at 5
- **WHEN** more than 5 notifications exist
- **THEN** only the 5 most recent are visible in the stack; earlier ones are accessible by scrolling or are queued

---

### Requirement: Error notifications include a details disclosure
The system SHALL render error toasts with three elements: a brief message, a `[details]` pseudo-link, and a close button (`✕`). Clicking `[details]` opens a dialog containing the full error text and a copy-to-clipboard button.

#### Scenario: Details dialog shows full error text
- **WHEN** user clicks `[details]` on an error toast
- **THEN** a dialog opens displaying the full `detail` field of the notification

#### Scenario: Copy button copies to clipboard
- **WHEN** user clicks the copy button in the details dialog
- **THEN** the full error text is written to the system clipboard

#### Scenario: Close button dismisses toast
- **WHEN** user clicks `✕` on a toast
- **THEN** the notification is removed from the store and the toast disappears

---

### Requirement: Error notifications require manual dismissal
The system SHALL NOT auto-dismiss notifications with `kind: 'error'`. They remain visible until the user clicks the close button.

#### Scenario: Error toast persists
- **WHEN** an error notification is pushed
- **THEN** it remains in the store indefinitely until `dismiss(id)` is called

#### Scenario: Info/success notifications may auto-dismiss
- **WHEN** a notification with `autoDismissMs` set is pushed
- **THEN** it is automatically removed from the store after that duration
