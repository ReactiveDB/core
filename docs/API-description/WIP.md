- ```[WIP]PredicateMeta```
<table>
  <tr></tr>
</table>


    [WIP]~~PredicateMeta~~:

    PredicateMeta 的详细描述参见 Predicate 部分

    ```ts
    {
      project: {
        created: {
          '$gt': new Date().valueOf()
        }
      },
      '$or': {
        _id: 'xxxx',
        updated: {
          '$lt': new Date(2015, 1, 1).valueOf()
        },
        _executorId: 'memberId'
      }
    }
    ```
