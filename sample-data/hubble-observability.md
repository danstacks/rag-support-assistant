# Hubble - Network Observability for Kubernetes

## Overview

Hubble is a fully distributed networking and security observability platform built on top of Cilium and eBPF. It provides deep visibility into the communication and behavior of services as well as the networking infrastructure.

## Key Capabilities

### Flow Visibility
- Real-time network flow monitoring
- L3/L4 and L7 protocol visibility
- DNS query/response logging
- HTTP request/response details

### Service Maps
- Automatic service dependency mapping
- Visual representation of traffic flows
- Identify communication patterns

### Metrics & Monitoring
- Prometheus-compatible metrics
- Grafana dashboards
- Alert integration

## Installation

### Enable Hubble with Cilium

```bash
helm upgrade cilium cilium/cilium --version 1.14.0 \
  --namespace kube-system \
  --set hubble.enabled=true \
  --set hubble.relay.enabled=true \
  --set hubble.ui.enabled=true
```

### Access Hubble UI

```bash
# Port forward the Hubble UI
kubectl port-forward -n kube-system svc/hubble-ui 12000:80

# Open in browser: http://localhost:12000
```

## Using Hubble CLI

### Install Hubble CLI

```bash
# Linux
curl -L --remote-name-all https://github.com/cilium/hubble/releases/latest/download/hubble-linux-amd64.tar.gz
tar xzvf hubble-linux-amd64.tar.gz
sudo mv hubble /usr/local/bin
```

### Basic Commands

```bash
# Observe all flows
hubble observe

# Filter by namespace
hubble observe --namespace default

# Filter by pod
hubble observe --pod frontend

# Filter by verdict (dropped traffic)
hubble observe --verdict DROPPED

# Filter by HTTP
hubble observe --protocol http

# Follow flows in real-time
hubble observe --follow
```

### Advanced Filtering

```bash
# Show only traffic to a specific service
hubble observe --to-service backend

# Show DNS queries
hubble observe --protocol dns

# Show dropped traffic with reasons
hubble observe --verdict DROPPED -o json | jq '.drop_reason'

# Filter by label
hubble observe --to-label app=database
```

## Troubleshooting with Hubble

### Debugging Connectivity Issues

1. **Check if traffic is being dropped**
```bash
hubble observe --verdict DROPPED --pod problematic-pod
```

2. **Verify DNS resolution**
```bash
hubble observe --protocol dns --pod problematic-pod
```

3. **Check policy enforcement**
```bash
hubble observe --type policy-verdict
```

### Common Drop Reasons

| Reason | Description | Solution |
|--------|-------------|----------|
| POLICY_DENIED | Network policy blocked traffic | Review CiliumNetworkPolicy |
| NO_ROUTE | No route to destination | Check routing configuration |
| INVALID_PACKET | Malformed packet | Check application behavior |

## Metrics

Hubble exports metrics to Prometheus:

### Key Metrics

- `hubble_flows_processed_total` - Total flows processed
- `hubble_drop_total` - Total dropped packets by reason
- `hubble_tcp_flags_total` - TCP flags observed
- `hubble_dns_queries_total` - DNS queries by type

### Grafana Dashboard

Import the official Hubble dashboard:
- Dashboard ID: 16611

## Best Practices

1. **Enable flow logging selectively** in production to manage storage
2. **Use filters** to focus on relevant traffic
3. **Set up alerts** for dropped traffic spikes
4. **Integrate with existing monitoring** (Prometheus/Grafana)
5. **Use service maps** for architecture documentation
