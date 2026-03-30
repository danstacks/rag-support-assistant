# Cilium Quick Start Guide

## What is Cilium?

Cilium is an open source project that provides networking, security, and observability for cloud native environments such as Kubernetes clusters and other container orchestration platforms.

At the foundation of Cilium is eBPF (extended Berkeley Packet Filter), a revolutionary Linux kernel technology that enables dynamic insertion of powerful security, visibility, and networking control logic directly into the Linux kernel.

## Key Features

### Networking
- **High-performance networking**: Cilium provides high-performance networking for Kubernetes using eBPF
- **Load balancing**: Built-in load balancing for Kubernetes services
- **Multi-cluster connectivity**: Connect multiple Kubernetes clusters seamlessly

### Security
- **Network policies**: Implement fine-grained network policies at L3/L4 and L7
- **Identity-based security**: Security policies based on pod identity, not IP addresses
- **Encryption**: Transparent encryption between nodes using WireGuard or IPsec

### Observability
- **Hubble**: Built-in observability platform for network flows
- **Metrics**: Prometheus metrics for monitoring
- **Flow logs**: Detailed logs of all network traffic

## Installation

### Prerequisites
- Kubernetes cluster (1.16+)
- Helm 3.0+
- Linux kernel 4.19+ (5.4+ recommended)

### Install with Helm

```bash
# Add the Cilium Helm repository
helm repo add cilium https://helm.cilium.io/

# Install Cilium
helm install cilium cilium/cilium --version 1.14.0 \
  --namespace kube-system
```

### Verify Installation

```bash
# Check Cilium status
cilium status

# Run connectivity test
cilium connectivity test
```

## Basic Network Policy

Here's an example of a basic Cilium network policy:

```yaml
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: allow-frontend-to-backend
spec:
  endpointSelector:
    matchLabels:
      app: backend
  ingress:
  - fromEndpoints:
    - matchLabels:
        app: frontend
    toPorts:
    - ports:
      - port: "80"
        protocol: TCP
```

## Troubleshooting

### Common Issues

1. **Pods not getting IP addresses**
   - Check Cilium agent logs: `kubectl logs -n kube-system -l k8s-app=cilium`
   - Verify IPAM configuration

2. **Network policies not working**
   - Ensure policy enforcement is enabled
   - Check policy status: `cilium policy get`

3. **High latency**
   - Check if eBPF programs are loaded: `cilium bpf`
   - Verify kernel version compatibility

### Useful Commands

```bash
# Get Cilium endpoints
cilium endpoint list

# Check BPF maps
cilium bpf lb list

# Monitor network flows
hubble observe
```

## Resources

- [Official Documentation](https://docs.cilium.io/)
- [GitHub Repository](https://github.com/cilium/cilium)
- [Slack Community](https://cilium.io/slack)
