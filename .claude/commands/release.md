---
description: release and push
---

## Instructions to Push a New Release

- Ensure the version in manifest.json gets increased
- Ensure that all open remaining changes are committed
- Each new version needs to be tagged:

```
git tag -a 1.0.1 -m "1.0.1"
git push origin 1.0.1
```

- Push to Origin
