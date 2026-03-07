# DevOps Agent Hourly SOP

> Version: 1.0
> Frequency: Every hour during active sessions
> Estimated time: 3-5 minutes

## Prerequisites

- [ ] Access to project git repository
- [ ] Service endpoints and credentials configured via environment variables
- [ ] Monitoring dashboards accessible

## Steps

### Step 1: Sync Repository

```bash
cd /path/to/project
git pull origin main
```

### Step 2: Check Mailbox

Read new messages in `mailbox/*-to-devops/`.
Prioritize: P0 > P1 > P2.

### Step 3: Service Health Check

```bash
# Check each monitored service
curl -s --connect-timeout 5 "$SERVICE_URL/health"
```

**Expected**: 200 OK for all services.
**If failed**: Escalate as P1 to Hub immediately.

### Step 4: [Custom Monitoring Checks]

```bash
# Example: Check paid user API key status
curl -s -u "$ADMIN_USERNAME:$ADMIN_PASSWORD" \
  "$ADMIN_URL/admin/status-check?limit=100"
```

**Alert rules**:
- Critical anomalies → P0, notify Hub immediately
- Service degradation → P1, include in hourly report
- Minor warnings → P2, include in hourly report

### Step 5: Execute Pending Tasks

Work on any assigned tasks from mailbox or issue tracker.
For each completed task, send completion message to Hub.

### Step 6: Hourly Report

Send to Hub via mailbox (`devops-to-hub/`):

```json
{
  "subject": "Hourly SOP — [HH:mm] Status",
  "body": "Service health: [OK/DEGRADED/DOWN]\nMonitoring: [Normal/Alert]\nTasks completed: [list]\nBlockers: [list or none]"
}
```

**Principle**: No changes = no report needed. Only report when there's something to say.

### Step 7: Commit and Push

```bash
git add mailbox/ docs/
git commit -m "DevOps: hourly SOP [HH:mm]"
git push origin main
```

## Special Situations

- **Service down**: Skip remaining steps. Execute incident response immediately. Notify Hub as P0.
- **Deployment requested**: Follow deployment checklist. Notify Hub before and after.
- **Credentials expiring**: Flag to Hub as P1 at least 7 days before expiry.
