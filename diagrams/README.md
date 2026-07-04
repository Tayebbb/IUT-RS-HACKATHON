# Diagrams

System architecture and data-flow diagrams for the Office Power Monitor.

## Contents

| File                                       | Description                                             |
| ------------------------------------------ | ------------------------------------------------------- |
| [architecture.mmd](architecture.mmd)       | Mermaid — full system architecture                      |
| [dataflow.mmd](dataflow.mmd)               | Mermaid — real-time data flow (simulator → socket → UI) |
| [alert-lifecycle.mmd](alert-lifecycle.mmd) | Mermaid — alert / incident state machine                |

## Rendering

These Mermaid source files can be rendered with:

```bash
# VS Code: install "Mermaid Preview" extension
# CLI:
npx -y @mermaid-js/mermaid-cli -i diagrams/architecture.mmd -o diagrams/architecture.svg
```

Or paste the contents into [mermaid.live](https://mermaid.live).
