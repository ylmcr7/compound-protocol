##  1.config
  directory: deploy/config
 
  example:JumpRateModelV2_0

## 2.migrate
```
truffle migrate  --network hecochain
```
## 3.Verify
  directory: deploy/script/contractVerify
  ``` 
  truffle exec ./deploy/script/contractVerify.js --network hecochain
  ```