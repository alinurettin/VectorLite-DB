# 📐 System Architecture Specification: VectorLite-DB v2.0.0
- **Project:** VectorLite-DB
- **Author:** Expert Software Architect
- **Status:** APPROVED & IN PRODUCTION
- **Version:** 2.0.0

## 1. High-Level Component Topology

```mermaid
flowchart TD
    Client["🌐 Client Applications / RAG Pipeline"] -->|HTTP REST / JSON| Gateway["⚡ HTTP Server Entrypoint (src/index.js)"]
    Gateway --> Parser["🔍 Payload Deserializer & Dimension Checker"]
    Parser --> Engine["🧠 VectorLiteDB Core Engine (src/engine.js)"]
    
    subgraph Engine["Algorithmic Execution Core"]
        direction TB
        Norm["L2 Normalization Kernel"]
        Math["VectorMath (Cosine, Euclidean, Dot)"]
        Index["In-Memory Map Store (ID -> Float64Array)"]
        KMeans["K-Means Clusterer (Centroid Convergence)"]
    end
    
    Engine --> Results["Ranked Candidate Priority Array"]
    Results --> Gateway
```

## 2. Distance Computation Flow

```mermaid
sequenceDiagram
    autonumber
    actor App as Client / LLM Agent
    participant API as HTTP API Server (src/index.js)
    participant Core as VectorLiteDB (src/engine.js)
    participant Math as VectorMath Kernel

    App->>API: POST /api/query (queryVector, topK, metric, filter)
    API->>Core: query(queryVector, options)
    loop Every Indexed Vector
        Core->>Core: Evaluate Metadata Filter
        opt Matches Filter
            Core->>Math: cosineSimilarity / euclideanDistance
            Math-->>Core: numerical score
        end
    end
    Core->>Core: Sort & Slice Top-K
    Core-->>API: { results, latencyMs }
    API-->>App: 200 OK (Ranked Candidates)
```
