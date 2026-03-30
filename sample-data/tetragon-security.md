# Tetragon - eBPF-based Security Observability and Runtime Enforcement

## What is Tetragon?

Tetragon is a powerful eBPF-based security observability and runtime enforcement tool. It provides deep visibility into system and application behavior, enabling security teams to detect and prevent threats in real-time.

## Key Features

### Process Execution Monitoring
- Track all process executions
- Capture command-line arguments
- Monitor process lineage (parent-child relationships)

### File Access Monitoring
- Detect file reads/writes
- Monitor sensitive file access
- Track configuration changes

### Network Activity
- Monitor network connections
- Detect unexpected outbound connections
- Track DNS queries

### Runtime Enforcement
- Block malicious activities in real-time
- Enforce security policies at kernel level
- Prevent container escapes

## Installation

### Install Tetragon on Kubernetes

```bash
helm repo add cilium https://helm.cilium.io
helm repo update

helm install tetragon cilium/tetragon -n kube-system
```

### Verify Installation

```bash
kubectl get pods -n kube-system -l app.kubernetes.io/name=tetragon
```

## Using Tetragon

### View Events with tetra CLI

```bash
# Install tetra CLI
curl -L https://github.com/cilium/tetragon/releases/latest/download/tetra-linux-amd64.tar.gz | tar xz
sudo mv tetra /usr/local/bin/

# Stream events
kubectl exec -n kube-system ds/tetragon -c tetragon -- tetra getevents
```

### Event Types

1. **process_exec** - Process execution events
2. **process_exit** - Process termination events
3. **process_kprobe** - Kernel probe events
4. **process_tracepoint** - Tracepoint events

## TracingPolicy Examples

### Monitor Sensitive File Access

```yaml
apiVersion: cilium.io/v1alpha1
kind: TracingPolicy
metadata:
  name: monitor-sensitive-files
spec:
  kprobes:
  - call: "fd_install"
    syscall: false
    args:
    - index: 0
      type: int
    - index: 1
      type: "file"
    selectors:
    - matchArgs:
      - index: 1
        operator: "Prefix"
        values:
        - "/etc/passwd"
        - "/etc/shadow"
        - "/root/.ssh"
```

### Detect Container Escape Attempts

```yaml
apiVersion: cilium.io/v1alpha1
kind: TracingPolicy
metadata:
  name: detect-container-escape
spec:
  kprobes:
  - call: "__x64_sys_setns"
    syscall: true
    args:
    - index: 0
      type: "int"
    - index: 1
      type: "int"
```

### Monitor Network Connections

```yaml
apiVersion: cilium.io/v1alpha1
kind: TracingPolicy
metadata:
  name: monitor-network
spec:
  kprobes:
  - call: "tcp_connect"
    syscall: false
    args:
    - index: 0
      type: "sock"
```

## Security Use Cases

### 1. Cryptomining Detection
Monitor for:
- Unexpected CPU-intensive processes
- Connections to mining pools
- Suspicious binary executions

### 2. Lateral Movement Detection
Track:
- SSH connections between pods
- Credential file access
- Network scanning activity

### 3. Data Exfiltration Prevention
Monitor:
- Large outbound data transfers
- Connections to unknown external IPs
- Access to sensitive data stores

### 4. Compliance Auditing
Log:
- All privileged operations
- Configuration file changes
- User authentication events

## Integration

### Export to SIEM

Tetragon can export events to:
- Elasticsearch
- Splunk
- Any JSON-compatible system

```bash
# Export events as JSON
kubectl exec -n kube-system ds/tetragon -c tetragon -- \
  tetra getevents -o json
```

### Prometheus Metrics

Key metrics:
- `tetragon_events_total` - Total events by type
- `tetragon_policy_events_total` - Policy-triggered events
- `tetragon_errors_total` - Processing errors

## Best Practices

1. **Start with observability** before enforcement
2. **Test policies** in non-production first
3. **Use namespaced policies** for granular control
4. **Monitor policy performance** impact
5. **Integrate with incident response** workflows
