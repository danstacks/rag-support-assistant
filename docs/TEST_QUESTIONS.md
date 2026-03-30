# RAG Quality Test Questions

Use these questions to evaluate how well your RAG system handles different scenarios. A good RAG system should answer questions grounded in the documentation AND gracefully handle questions outside its knowledge.

---

## ✅ Questions That SHOULD Work Well

These questions have clear answers in the Cilium/Isovalent documentation:

### Basic Knowledge
| Question | Expected Behavior |
|----------|-------------------|
| "How do I install Cilium on Kubernetes?" | Clear installation steps with Helm commands |
| "What is eBPF?" | Explanation of eBPF and its role in Cilium |
| "How do I enable Hubble?" | Configuration steps for Hubble |

### Troubleshooting
| Question | Expected Behavior |
|----------|-------------------|
| "My pods can't communicate after installing Cilium. How do I debug?" | Troubleshooting steps, useful commands |
| "How do I check if Cilium is running correctly?" | `cilium status`, connectivity test commands |
| "What does 'POLICY_DENIED' mean in Hubble?" | Explanation of network policy enforcement |

### Technical Deep-Dives
| Question | Expected Behavior |
|----------|-------------------|
| "What's the difference between CiliumNetworkPolicy and Kubernetes NetworkPolicy?" | Comparison of features, L7 capabilities |
| "How does Tetragon detect process execution?" | Explanation of eBPF kprobes, TracingPolicy |
| "How do I monitor network flows with Hubble CLI?" | `hubble observe` commands and filters |

---

## ❌ Questions That SHOULD Fail Gracefully

These questions are **outside the scope** of the documentation. A good RAG system should:
- Admit it doesn't have information about this
- NOT hallucinate capabilities that don't exist
- Potentially clarify what the technology actually does

### Out-of-Scope Use Cases

#### 🧪 Test Question 1: Peripheral Device Blocking
> "Is it possible with Tetragon to block pluggable peripherals access to the end device? I am thinking as an alternative to endpoint protection software. Could you use eBPF to filter/block/observe peripherals being connected to a device and what said peripheral attempts to do?"

**Why this should fail:**
- Tetragon is for **cloud-native/container security**, not endpoint device management
- It monitors process execution, file access, and network activity - NOT USB/hardware peripherals
- This is asking about traditional endpoint protection (EDR) use cases

**Good response would:**
- Explain that Tetragon focuses on runtime security in Kubernetes/container environments
- Clarify it doesn't handle hardware peripheral management
- Possibly suggest this is outside its design scope

**Bad response would:**
- Claim Tetragon can block USB devices
- Hallucinate eBPF hooks for peripheral management
- Provide made-up configuration examples

---

#### 🧪 Test Question 2: Windows Support
> "How do I install Cilium on Windows Server 2022?"

**Why this should fail:**
- Cilium requires Linux kernel with eBPF support
- Windows doesn't have native eBPF (yet)

**Good response:** Explain Linux kernel requirement

---

#### 🧪 Test Question 3: Unrelated Technology
> "How do I configure Istio service mesh with Cilium?"

**Why this is tricky:**
- Cilium can replace Istio's data plane, but they're different projects
- If docs don't cover Istio integration, it should say so

---

#### 🧪 Test Question 4: Made-Up Feature
> "How do I enable Cilium's AI-powered threat detection?"

**Why this should fail:**
- This feature doesn't exist
- Tests if the system invents capabilities

**Good response:** "I don't have information about an AI-powered threat detection feature in Cilium."

---

## 🔍 Evaluating Responses

### Signs of a GOOD RAG Response
- ✅ Cites specific sources from the documentation
- ✅ Admits uncertainty when information isn't available
- ✅ Stays within the bounds of indexed content
- ✅ Provides actionable, accurate information

### Signs of a BAD RAG Response (Hallucination)
- ❌ Invents features or capabilities not in the docs
- ❌ Provides confident answers without source citations
- ❌ Makes up configuration syntax or commands
- ❌ Answers questions clearly outside the technology's scope

---

## Demo Script: Testing RAG Quality

During your demo, consider showing both success AND graceful failure:

### 1. Show a Working Question
> "How do I use Hubble to monitor dropped packets?"

*Expected: Good answer with `hubble observe --verdict DROPPED` command*

### 2. Show Graceful Failure
> "Can Tetragon block USB devices from being connected?"

*Expected: Honest response that this isn't what Tetragon does*

### 3. Explain Why This Matters
- "RAG systems are only as good as their grounding"
- "A system that admits 'I don't know' is more trustworthy than one that makes things up"
- "This is why we show sources - transparency builds trust"

---

## Adding Your Own Test Questions

When testing with your own documentation:

1. **Create 5-10 questions with known answers** - verify accuracy
2. **Create 3-5 out-of-scope questions** - verify graceful failure
3. **Create 2-3 ambiguous questions** - see how it handles uncertainty

This helps you tune:
- Chunk size (too small = missing context, too large = noise)
- Top-K results (too few = missing info, too many = confusion)
- System prompt (guides how to handle uncertainty)
