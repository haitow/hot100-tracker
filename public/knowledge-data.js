(() => {
  'use strict';
  const categories = [
    { id: 'api', title: 'Java 常用 API' },
    { id: 'basics', title: '基础算法与数据结构' },
    { id: 'patterns', title: '解题思想' },
  ];
  const oracle = (name, group = 'util') => ({ title: `Oracle Java 8 · ${name}`, url: `https://docs.oracle.com/javase/8/docs/api/java/${group}/${name}.html` });
  const topics = [
    {
      id: 'hashmap', category: 'api', title: 'HashMap · 键值映射', aliases: ['map', '哈希表', '映射', '字典'],
      summary: '按键查值、记录频率、建立分组。键唯一，值可以重复；不保证遍历顺序。刷题时通常使用 Map<K, V> map = new HashMap<>();',
      problems: [1, 49, 560, 146, 347, 437], sources: [oracle('HashMap')],
      sections: [
        { id: 'quick', title: '常用方法速查', headers: ['方法名', '功能描述'], rows: [
          ['put(K key, V value)', '添加或更新键值对'],
          ['get(Object key)', '根据键获取值，不存在时返回 null'],
          ['remove(Object key)', '根据键删除键值对'],
          ['containsKey(Object key)', '判断是否包含指定的键'],
          ['containsValue(Object value)', '判断是否包含指定的值'],
          ['getOrDefault(Object key, V defaultValue)', '获取键对应的值，键不存在时返回默认值'],
          ['putIfAbsent(K key, V value)', '键缺失或对应值为 null 时写入键值对'],
          ['computeIfAbsent(K key, Function mappingFunction)', '键缺失或对应值为 null 时，通过函数生成值'],
          ['merge(K key, V value, BiFunction remappingFunction)', '将新值与已有值合并'],
          ['replace(K key, V value)', '替换已有键对应的值'],
          ['keySet()', '获取所有键的集合视图'],
          ['values()', '获取所有值的集合视图'],
          ['entrySet()', '获取所有键值对的集合视图'],
          ['size()', '获取键值对数量'],
          ['isEmpty()', '判断映射是否为空'],
          ['clear()', '清空所有键值对'],
        ] },
        { id: 'get-or-default', title: 'getOrDefault() · 频率计数', paragraphs: ['只需要维护计数时，让未出现的键从 0 开始。它读取默认值，不会自动把默认值写回 Map。'],
          code: 'Map<Integer, Integer> counts = new HashMap<>();\nint[] values = {2, 2, 5};\nfor (int value : values) {\n    counts.put(value, counts.getOrDefault(value, 0) + 1);\n}\nSystem.out.println(counts.get(2)); // 2\nSystem.out.println(counts.getOrDefault(7, 0)); // 0',
          headers: ['输入', '计数变化'], rows: [['2', '{2=1}'], ['2', '{2=2}'], ['5', '{2=2, 5=1}']] },
        { id: 'compute-if-absent', title: 'computeIfAbsent() · 创建分组', paragraphs: ['键不存在或当前值为 null 时，调用函数生成值。返回生成或已有的值；生成 null 时不新增映射。适合把元素追加到所属列表。'],
          code: 'Map<String, List<Integer>> groups = new HashMap<>();\ngroups.computeIfAbsent("even", key -> new ArrayList<>()).add(2);\ngroups.computeIfAbsent("even", key -> new ArrayList<>()).add(4);\nSystem.out.println(groups.get("even")); // [2, 4]' },
        { id: 'iterate', title: 'entrySet() · 遍历键值对', code: 'Map<String, Integer> counts = new HashMap<>();\ncounts.put("apple", 2);\nfor (Map.Entry<String, Integer> entry : counts.entrySet()) {\n    String key = entry.getKey();\n    int count = entry.getValue();\n    System.out.println(key + ": " + count);\n}', paragraphs: ['entrySet() 能同时拿到键和值。HashMap 不提供排序保证，输出顺序不能作为算法条件。'] },
        { id: 'cost', title: '复杂度与易错点', list: ['哈希分布合理时，get/put/containsKey/remove 的期望时间为 O(1)；哈希冲突会影响性能。', 'containsValue() 需要查找值，通常是 O(n)；遍历 HashMap 与容量加条目数有关。', '把需要统计频率的问题写成 HashSet 会丢失次数；自定义键的 equals/hashCode 必须保持一致。', '不要依赖 Integer 包装对象的 == 比较值；使用 equals，或先安全拆箱。'] },
      ],
    },
    {
      id: 'binary-search', category: 'basics', title: '二分查找 · 边界与区间', aliases: ['binary search', 'lower bound', '左边界', '右边界'],
      summary: '利用有序性或单调判断，每次排除一半候选。先定义区间含义，再写边界更新。下面统一使用左闭右开区间 [left, right)。',
      problems: [35, 34, 33, 153, 4, 74, 240, 300], sources: [],
      sections: [
        { id: 'quick', title: '速查 · 第一个大于等于 target 的位置', list: ['left = 0，right = a.length；答案允许等于 a.length，表示全部元素小于 target。', 'while (left < right)；mid = left + (right - left) / 2。', 'a[mid] < target：left = mid + 1；否则 right = mid。'], paragraphs: ['输入必须按非降序排列。每次更新都缩小区间；循环结束时 left == right。'] },
        { id: 'reason', title: '原理与适用条件', paragraphs: ['维护两个已确定区域：[0, left) 都小于 target，[right, n) 都大于等于 target。中间区间是仍待判断的候选。a[mid] 小于 target 时，mid 及其左侧都不可能是答案；否则答案仍可能是 mid，所以保留它。', '普通二分需要有序数组；“对答案二分”需要可证明的单调可行性判断。旋转数组或二维结构需要另行分析，不能直接套用下面的有序数组模板。'] },
        { id: 'trace', title: '示例推演 · 查找重复元素的左边界', headers: ['数组 / 目标', 'left, right, mid', '更新'], rows: [['[1, 3, 3, 5] / 3', '0, 4, 2', 'a[2] >= 3 → right = 2'], ['同上', '0, 2, 1', 'a[1] >= 3 → right = 1'], ['同上', '0, 1, 0', 'a[0] < 3 → left = 1'], ['循环结束', '1, 1', '返回 1；第一个 3 的下标']] },
        { id: 'template', title: 'Java 模板 · lowerBound()', code: 'static int lowerBound(int[] a, int target) {\n    int left = 0, right = a.length;\n    while (left < right) {\n        int mid = left + (right - left) / 2;\n        if (a[mid] < target) {\n            left = mid + 1;\n        } else {\n            right = mid;\n        }\n    }\n    return left;\n}', paragraphs: ['返回的是插入位置。判断 target 是否存在，还要检查 pos < a.length && a[pos] == target。找第一个严格大于 target 的位置时，将判断改为 a[mid] <= target。'] },
        { id: 'cost', title: '复杂度与边界检查', list: ['时间 O(log n)，额外空间 O(1)。', '空数组返回 0；目标小于全部元素返回 0；目标大于全部元素返回 n。', '有重复值时仍返回最左位置；不要把闭区间的 right = mid - 1 混进此模板。', '求最后一个等于 target 的位置：先求严格大于 target 的位置，再减一并验证元素。'] },
      ],
    },
  ];
  function api(id, title, aliases, summary, problems, source, methods, example, trace, pitfalls) {
    topics.push({ id, category: 'api', title, aliases, summary, problems, sources: [source], sections: [
      { id: 'quick', title: '常用方法速查', headers: ['方法名', '功能描述'], rows: methods },
      { id: 'example', title: 'Java 示例与使用场景', paragraphs: [summary], code: example },
      { id: 'trace', title: '示例推演', headers: ['操作', '结果与含义'], rows: trace },
      { id: 'cost', title: '复杂度与易错点', list: pitfalls },
    ] });
  }
  api('hashset', 'HashSet · 去重与判重', ['set', '集合', '去重', '存在性'],
    '只关心元素是否出现过时使用 Set。重复添加不会增加 size；不保证遍历顺序。', [128, 3, 73, 141, 160, 200], oracle('HashSet'), [
      ['add(E value)', '添加元素，新增成功时返回 true'],
      ['contains(Object value)', '判断是否包含指定元素'],
      ['remove(Object value)', '删除指定元素，删除成功时返回 true'],
      ['size()', '获取元素数量'],
      ['isEmpty()', '判断集合是否为空'],
      ['clear()', '清空所有元素'],
      ['iterator()', '获取用于遍历元素的迭代器'],
    ], `Set<Integer> seen = new HashSet<>();
System.out.println(seen.add(3)); // true
System.out.println(seen.add(3)); // false
System.out.println(seen.contains(3)); // true
System.out.println(seen.remove(3)); // true`,
    [['add(3)', '{3}，返回 true'], ['add(3)', '{3}，返回 false'], ['remove(3)', '{}，返回 true']],
    ['哈希分布合理时，add/contains/remove 期望 O(1)；遍历成本与容量加元素数有关。', '计数用 Map；有序性另选 TreeSet 或排序。', '自定义对象用 equals/hashCode 定义相等；放入集合后不要改变参与哈希的字段。']);

  api('arraylist', 'ArrayList · 动态数组', ['list', '列表', '动态数组'],
    '适合按下标访问、保存答案和维护路径。size 是已有元素数量；初始容量不是已有元素数量。', [49, 54, 56, 78, 46, 17, 39, 22, 131, 102, 199, 118], oracle('ArrayList'), [
      ['add(E value)', '在列表末尾添加元素'],
      ['add(int index, E value)', '在指定位置插入元素'],
      ['get(int index)', '获取指定下标的元素'],
      ['set(int index, E value)', '替换指定下标的元素'],
      ['remove(int index)', '删除指定下标的元素'],
      ['remove(Object value)', '删除第一个与指定值相等的元素'],
      ['contains(Object value)', '判断是否包含指定元素'],
      ['indexOf(Object value)', '获取首次出现的下标，不存在时返回 -1'],
      ['subList(int from, int to)', '获取左闭右开区间的列表视图'],
      ['size()', '获取元素数量'],
      ['isEmpty()', '判断列表是否为空'],
      ['clear()', '清空所有元素'],
    ], `List<Integer> values = new ArrayList<>(Arrays.asList(10, 20, 10));
values.remove(Integer.valueOf(10));
int old = values.set(0, 30);
List<Integer> snapshot = new ArrayList<>(values);
System.out.println(old); // 20
System.out.println(snapshot); // [30, 10]`,
    [['[10, 20, 10] → remove(Integer.valueOf(10))', '[20, 10]，删除第一个值 10'], ['set(0, 30)', '[30, 10]，返回 20'], ['new ArrayList<>(values)', '复制列表容器；元素对象仍共享']],
    ['get/set/size 为 O(1)，尾部 add 摊还 O(1)，中间插入/删除及 contains 通常 O(n)。', 'remove(1) 与 remove(Integer.valueOf(1)) 含义不同。', '回溯结果要复制路径；保存 path 本身会随后续修改一起变化。']);

  api('deque', 'Deque / ArrayDeque · 栈与队列 API', ['双端队列', 'stack', 'queue', 'offer', 'poll', 'peek'],
    '用 ArrayDeque 实现栈和队列。栈从同一端进出；队列从尾部入、头部出。ArrayDeque 不允许 null 元素。', [20, 155, 239, 94, 102, 994, 207, 394, 739, 84], oracle('ArrayDeque'), [
      ['offerLast(E value)', '在队尾添加元素'],
      ['offerFirst(E value)', '在队首添加元素'],
      ['pollFirst()', '移除并返回队首元素，空时返回 null'],
      ['pollLast()', '移除并返回队尾元素，空时返回 null'],
      ['peekFirst()', '查看队首元素，空时返回 null'],
      ['peekLast()', '查看队尾元素，空时返回 null'],
      ['push(E value)', '将元素压入栈顶'],
      ['pop()', '弹出栈顶元素'],
      ['peek()', '查看队首或栈顶元素'],
      ['offer(E value)', '在队尾添加元素'],
      ['poll()', '移除并返回队首元素，空时返回 null'],
      ['size()', '获取元素数量'],
      ['isEmpty()', '判断队列是否为空'],
    ], `Deque<Integer> stack = new ArrayDeque<>();
stack.push(1);
stack.push(2);
System.out.println(stack.pop()); // 2
Deque<Integer> queue = new ArrayDeque<>();
queue.offerLast(1);
queue.offerLast(2);
System.out.println(queue.pollFirst()); // 1`,
    [['push(1), push(2), pop()', '后进先出：返回 2'], ['offerLast(1), offerLast(2), pollFirst()', '先进先出：返回 1'], ['空队列 pollFirst()', '返回 null']],
    ['双端操作摊还 O(1)，contains/remove(Object) 通常 O(n)。', '空时先判空，避免将 null 拆箱。', '不接受 null，因此不能把空树节点直接加入 ArrayDeque。']);

  api('priorityqueue', 'PriorityQueue · 优先队列', ['heap', '小顶堆', '大顶堆', '比较器'],
    '默认每次取出最小元素；可用比较器改变优先级。适合维护最值、候选集合和 Top K。遍历顺序不等于出队顺序。', [215, 347, 23, 295], oracle('PriorityQueue'), [
      ['offer(E value)', '添加元素并维护优先级'],
      ['peek()', '查看优先级最高的元素，空时返回 null'],
      ['poll()', '取出优先级最高的元素，空时返回 null'],
      ['remove(Object value)', '删除一个与指定值相等的元素'],
      ['contains(Object value)', '判断是否包含指定元素'],
      ['size()', '获取元素数量'],
      ['isEmpty()', '判断优先队列是否为空'],
      ['clear()', '清空所有元素'],
    ], `PriorityQueue<Integer> minHeap = new PriorityQueue<>();
minHeap.offer(5);
minHeap.offer(2);
minHeap.offer(4);
System.out.println(minHeap.poll()); // 2
PriorityQueue<Integer> maxHeap = new PriorityQueue<>(Comparator.reverseOrder());
maxHeap.addAll(Arrays.asList(5, 2, 4));
System.out.println(maxHeap.poll()); // 5`,
    [['插入 5, 2, 4', '堆顶为 2；内部只保证堆序'], ['poll()', '返回 2，剩余堆顶为 4'], ['自定义降序比较器', '队首改为最大元素']],
    ['空间 O(n)；连续插入 n 次 O(n log n)，不等于一次线性建堆。', '不允许 null；元素需要自然顺序或显式 Comparator。', 'for-each 遍历堆不会得到排序结果；需要依次 poll。']);

  api('arrays', 'Arrays · 数组工具', ['数组', 'sort', 'binarySearch', 'fill', 'copyOf', 'asList'],
    '数组长度固定，a.length 是字段。Arrays 提供排序、查找、填充和复制；区间参数通常采用左闭右开。', [189, 238, 56, 75, 31, 49, 15, 35, 34, 300], oracle('Arrays'), [
      ['Arrays.sort(int[] a)', '对整个数组原地升序排序'],
      ['Arrays.sort(int[] a, int from, int to)', '对左闭右开区间原地升序排序'],
      ['Arrays.binarySearch(int[] a, int key)', '在有序数组中查找元素下标'],
      ['Arrays.fill(int[] a, int value)', '用指定值填充数组'],
      ['Arrays.copyOf(int[] a, int length)', '按指定长度复制为新数组'],
      ['Arrays.copyOfRange(int[] a, int from, int to)', '将左闭右开区间复制为新数组'],
      ['Arrays.equals(int[] a, int[] b)', '比较两个数组的元素是否相等'],
      ['Arrays.deepEquals(Object[] a, Object[] b)', '比较嵌套数组的内容是否相等'],
      ['Arrays.asList(T... values)', '将对象元素转换为固定大小的列表'],
      ['Arrays.toString(int[] a)', '将数组内容转换为字符串'],
    ], `int[] a = {5, 1, 3};
Arrays.sort(a);
int index = Arrays.binarySearch(a, 2);
int insertion = -index - 1;
int[] copy = Arrays.copyOf(a, a.length);
System.out.println(Arrays.toString(copy)); // [1, 3, 5]
System.out.println(insertion); // 1`,
    [['sort([5, 1, 3])', '[1, 3, 5]，修改原数组'], ['binarySearch(a, 2)', '-2，对应插入点 1'], ['copyOf(a, 3)', '新容器，修改其中 int 不影响原数组']],
    ['排序通常 O(n log n)；binarySearch 对已排序数组为 O(log n)；fill/复制 O(n)。', 'Arrays.asList 返回固定大小列表，add/remove 不支持；可用 new ArrayList<>(...) 建可变列表。', '二维数组的 clone 是浅复制；独立二维副本需要逐行复制。']);

  api('collections', 'Collections / Comparator · 集合排序', ['比较器', 'reverseOrder', 'sort', 'reverse', 'min', 'max'],
    'Collections 操作集合，Arrays 操作数组。比较器表达顺序关系，负数表示前者排前面，零表示排序键相等。', [56, 49, 347, 23, 295, 763, 15], oracle('Collections'), [
      ['Collections.sort(List<T> list)', '按自然顺序对列表原地排序'],
      ['List.sort(Comparator comparator)', '按指定比较器对列表原地排序'],
      ['Collections.reverse(List<?> list)', '原地反转列表顺序'],
      ['Collections.min(Collection<T> values)', '获取集合中的最小元素'],
      ['Collections.max(Collection<T> values)', '获取集合中的最大元素'],
      ['Collections.reverseOrder()', '获取自然顺序的逆序比较器'],
      ['Comparator.comparingInt(ToIntFunction keyExtractor)', '按提取的整数键创建比较器'],
      ['Comparator.thenComparingInt(ToIntFunction keyExtractor)', '为排序追加整数比较键'],
      ['Integer.compare(int a, int b)', '比较两个整数的大小'],
    ], `List<Integer> values = new ArrayList<>(Arrays.asList(4, 1, 3));
values.sort(Integer::compare);
Collections.reverse(values);
System.out.println(values); // [4, 3, 1]
Integer[] scores = {2, 9, 5};
Arrays.sort(scores, Comparator.reverseOrder());
System.out.println(Arrays.toString(scores)); // [9, 5, 2]`,
    [['自然升序 [4,1,3]', '[1,3,4]'], ['reverse 已排序列表', '[4,3,1]'], ['比较 Integer.MIN_VALUE 与 Integer.MAX_VALUE', '用 Integer.compare，不能直接相减']],
    ['列表排序通常 O(n log n)，reverse/min/max 通常 O(n)。', '多关键字排序可用 comparingInt(...).thenComparingInt(...)。', '排序结果依赖比较器的一致性；不要在比较时修改元素。']);

  api('string', 'String · 字符串与字符数组', ['charAt', 'substring', 'toCharArray', 'indexOf', '字符串'],
    'String 不可变；修改字符时转成 char[]，频繁拼接用 StringBuilder。Java 的 char 是 UTF-16 代码单元。', [3, 438, 76, 20, 394, 17, 22, 131, 79, 139, 1143, 5, 72], oracle('String', 'lang'), [
      ['length()', '获取字符串长度'],
      ['charAt(int index)', '获取指定下标的字符'],
      ['substring(int from, int to)', '截取左闭右开区间的子串'],
      ['substring(int from)', '截取指定下标到末尾的子串'],
      ['toCharArray()', '转换为新的字符数组'],
      ['indexOf(String part)', '获取首次匹配的下标，不存在时返回 -1'],
      ['equals(Object other)', '比较字符串内容是否相等'],
      ['split(String regex)', '按正则表达式拆分字符串'],
      ['startsWith(String prefix)', '判断是否以指定前缀开头'],
      ['endsWith(String suffix)', '判断是否以指定后缀结尾'],
    ], `String text = "abcab";
char[] chars = text.toCharArray();
chars[0] = 'z';
System.out.println(text.substring(1, 3)); // bc
System.out.println(text.indexOf("ab")); // 0
System.out.println(new String(chars)); // zbcab
System.out.println("abcab".equals(text)); // true`,
    [['substring(1,3)', '取下标 1,2；结果 bc'], ['char[] 中把 a 改成 z', '原字符串仍为 abcab'], ['indexOf("xx")', '返回 -1']],
    ['charAt/length 通常 O(1)；复制字符数组/子串与复制长度有关。', '循环中反复用 + 构造长结果会产生大量中间字符串；使用 StringBuilder。', '题目若不限小写英文字母，不要直接用 char - a 下标；完整 Unicode 需按码点处理。']);

  api('stringbuilder', 'StringBuilder · 可变字符串', ['append', 'deleteCharAt', 'reverse', '拼接'],
    '构造字符串、回溯路径和逆序输出时使用。每次 append 修改同一个对象；最终调用 toString() 得到 String。', [394, 17, 22, 131, 5, 2], oracle('StringBuilder', 'lang'), [
      ['append(String value)', '在末尾追加内容'],
      ['insert(int index, String value)', '在指定位置插入内容'],
      ['deleteCharAt(int index)', '删除指定下标的字符'],
      ['delete(int from, int to)', '删除左闭右开区间的字符'],
      ['setCharAt(int index, char value)', '替换指定下标的字符'],
      ['setLength(int length)', '调整字符序列长度'],
      ['reverse()', '原地反转字符序列'],
      ['toString()', '生成当前内容的字符串快照'],
      ['length()', '获取当前字符序列长度'],
    ], `StringBuilder path = new StringBuilder();
path.append('a');
int previousLength = path.length();
path.append("bc");
String snapshot = path.toString();
path.setLength(previousLength);
System.out.println(snapshot); // abc
System.out.println(path); // a`,
    [['append a，再追加 bc', '内容变成 abc'], ['toString()', '保存独立的字符串快照'], ['setLength(1)', '恢复为 a，便于撤销一次选择']],
    ['追加长度 k 的内容摊还 O(k)；reverse/toString 通常 O(n)。', '删除中间字符需要移动后续字符；回溯通常撤销末尾。', '保存答案时用 toString，而不是把可变 builder 本身存起来。']);

  api('math', 'Math / 数值类型 · 最值与溢出', ['abs', 'min', 'max', 'long', '溢出', '位运算'],
    '先判断数值范围，再选 int 或 long。赋值给 long 不会自动补救已经在 int 运算中发生的溢出。', [11, 42, 53, 121, 152, 238, 560, 70, 62, 279], oracle('Math', 'lang'), [
      ['Math.min(int a, int b)', '获取两个值中较小的值'],
      ['Math.max(int a, int b)', '获取两个值中较大的值'],
      ['Math.abs(int value)', '计算绝对值'],
      ['Math.addExact(int a, int b)', '计算和，溢出时抛出异常'],
      ['Math.multiplyExact(long a, long b)', '计算乘积，溢出时抛出异常'],
      ['Math.floorMod(int a, int b)', '计算向下取整除法对应的余数'],
      ['Math.pow(double a, double b)', '计算浮点数幂'],
      ['Math.sqrt(double value)', '计算平方根'],
    ], `int a = 100000, b = 100000;
long product = 1L * a * b;
int smaller = Math.min(3, 7);
long absolute = Math.abs((long) Integer.MIN_VALUE);
System.out.println(product); // 10000000000
System.out.println(smaller); // 3
System.out.println(absolute); // 2147483648`,
    [['int 100000 * 100000', '超过 int 范围'], ['1L * 100000 * 100000', '用 long 运算，得到 10000000000'], ['先将 MIN_VALUE 转 long 再 abs', '得到正确绝对值']],
    ['常见基本数值运算 O(1)；Math.pow 使用浮点，不适合精确整数幂模板。', '路径数、前缀和、面积和乘积可能溢出，按题目约束计算上界。', '取模后的负数可能仍为负；需要非负结果时考虑 Math.floorMod。']);

  function lesson(id, category, title, aliases, summary, problems, principle, steps, trace, code, cost, pitfalls) {
    topics.push({ id, category, title, aliases, summary, problems, sources: [], sections: [
      { id: 'quick', title: '速查 · 核心步骤', list: steps },
      { id: 'reason', title: '原理与适用条件', paragraphs: principle },
      { id: 'trace', title: '示例推演', headers: ['步骤 / 状态', '变化与原因'], rows: trace },
      { id: 'template', title: 'Java 通用模板', code },
      { id: 'cost', title: '复杂度与边界检查', paragraphs: [cost], list: pitfalls },
    ] });
  }

  lesson('bubble-sort', 'basics', '冒泡排序', ['bubble sort', '稳定排序'],
    '相邻元素比较交换，一轮把当前最大值送到末尾。适合理解交换与循环不变量；大数组通常采用更高效的排序。', [75, 56, 15],
    ['相邻元素逆序时交换，尚未有序的前缀逐步缩短。只在严格大于时交换，等值元素不会跨越，因此是稳定排序。', '某一轮没有交换说明整个待排序区间已无相邻逆序，可以提前结束。'],
    ['end 从 n-1 递减，遍历 i < end。', 'a[i] > a[i+1] 时交换，并记录发生交换。', '一轮没有交换则停止。'],
    [['[3,1,2]：比较 3 与 1', '[1,3,2]'], ['比较 3 与 2', '[1,2,3]，最大值固定'], ['第二轮没有交换', '提前结束']],
    `static void bubbleSort(int[] a) {
    for (int end = a.length - 1; end > 0; end--) {
        boolean changed = false;
        for (int i = 0; i < end; i++) {
            if (a[i] > a[i + 1]) {
                int temp = a[i]; a[i] = a[i + 1]; a[i + 1] = temp;
                changed = true;
            }
        }
        if (!changed) break;
    }
}`, '平均与最坏 O(n²)，已有序时 O(n)，额外空间 O(1)。',
    ['空数组、单元素数组不进入循环。', '内层访问 i+1，因此循环条件必须保证 i+1 在范围内。']);

  lesson('selection-sort', 'basics', '选择排序', ['selection sort', '选择最小值'],
    '每轮从未排序区间选择最小元素，交换到当前起点。交换次数少，但比较次数依然为二次量级。', [56, 75, 215],
    ['第 i 轮之前，[0,i) 已是排序后的最小 i 个元素；扫描 [i,n) 找最小值。', '远距离交换可能打乱相同值的相对顺序，所以常见实现不稳定。'],
    ['固定位置 i，先令 minIndex = i。', '扫描后缀，更新最小下标。', '交换 a[i] 与 a[minIndex]。'],
    [['[3,1,2]，i=0', '最小值下标 1，交换得到 [1,3,2]'], ['i=1', '找到 2，得到 [1,2,3]'], ['等值元素被远距离交换', '不能保证原有相对次序']],
    `static void selectionSort(int[] a) {
    for (int i = 0; i < a.length; i++) {
        int minIndex = i;
        for (int j = i + 1; j < a.length; j++) {
            if (a[j] < a[minIndex]) minIndex = j;
        }
        int temp = a[i]; a[i] = a[minIndex]; a[minIndex] = temp;
    }
}`, '最佳、平均、最坏均 O(n²)，额外空间 O(1)。', ['有序输入也需要扫描后缀。', '别把最小值本身与最小下标混用。']);

  lesson('insertion-sort', 'basics', '插入排序', ['insertion sort', '有序前缀'],
    '维护有序前缀，把新元素插入正确位置。小规模、近乎有序的数据很适合这个方法。', [56, 75, 15],
    ['将新元素暂存为 value，把比它大的前缀元素依次右移，空出来的位置就是插入点。', '只右移严格大于 value 的元素，等值元素的顺序不改变。'],
    ['从 i=1 开始，保存当前 value。', 'j 从 i-1 向左，较大元素右移。', '在 a[j+1] 放入 value。'],
    [['[3,1,2]：插入 1', '3 右移，得到 [1,3,2]'], ['插入 2', '3 右移，得到 [1,2,3]'], ['遇到相等元素', '停止移动，保持稳定性']],
    `static void insertionSort(int[] a) {
    for (int i = 1; i < a.length; i++) {
        int value = a[i], j = i - 1;
        while (j >= 0 && a[j] > value) {
            a[j + 1] = a[j];
            j--;
        }
        a[j + 1] = value;
    }
}`, '平均、最坏 O(n²)，已有序时 O(n)，额外空间 O(1)。', ['先保存 value，避免右移时覆盖它。', 'j 可能变为 -1，最终写入位置始终是 j+1。']);

  lesson('merge-sort', 'basics', '归并排序', ['merge sort', '分治', '稳定排序'],
    '把区间分成两半，各自排序，再线性合并两个有序区间。性能稳定，适合同时理解递归和分治。', [148, 23, 56],
    ['合并时比较两侧尚未取出的最小元素，每次选择较小者。递归返回时两个子区间已经有序。', '以下模板使用左闭右开区间 [left,right)，在相等时优先取左侧，保证稳定性。'],
    ['长度小于 2 时返回。', '递归排序 [left,mid) 与 [mid,right)。', '合并到临时数组，再复制回原区间。'],
    [['[4,1,3,2] 拆分', '[4,1] 与 [3,2]'], ['子区间排序', '[1,4] 与 [2,3]'], ['依次取较小值', '1 → 2 → 3 → 4']],
    `static void mergeSort(int[] a) {
    mergeRange(a, new int[a.length], 0, a.length);
}
static void mergeRange(int[] a, int[] temp, int left, int right) {
    if (right - left < 2) return;
    int mid = left + (right - left) / 2;
    mergeRange(a, temp, left, mid);
    mergeRange(a, temp, mid, right);
    int i = left, j = mid, k = left;
    while (i < mid || j < right) {
        if (j == right || (i < mid && a[i] <= a[j])) temp[k++] = a[i++];
        else temp[k++] = a[j++];
    }
    for (k = left; k < right; k++) a[k] = temp[k];
}`, '时间 O(n log n)，临时数组 O(n)，递归栈 O(log n)。', ['避免在每次递归中反复分配整长数组。', '数组归并需要临时空间，不能直接把左侧结果写回尚未读取的位置。']);

  lesson('quick-sort', 'basics', '快速排序', ['quick sort', 'partition', '三路划分'],
    '选择基准，将元素划分成小于、等于、大于三个区间，再递归处理两侧。三路划分对重复值友好。', [215, 75, 15, 56],
    ['维护 [left,lt) 小于基准，[lt,i) 等于基准，[i,gt] 未检查，(gt,right] 大于基准。', '随机基准降低遇到不利划分的概率，不能消除最坏 O(n²)。等于基准的区间无需再次递归。'],
    ['随机取基准值，lt=i=left，gt=right。', '较小值换到 lt，lt 与 i 前进；较大值换到 gt，gt 后退。', '较大值交换后，新 a[i] 未检查，i 不能立即前进。'],
    [['[3,1,3,2]，基准 3', '较小区间逐步得到 [1,2]'], ['划分完成', '[1,2] | [3,3] | []'], ['仅递归两侧', '等值区间已完成']],
    `static void quickSort(int[] a) {
    quickRange(a, 0, a.length - 1, new Random());
}
static void quickRange(int[] a, int left, int right, Random random) {
    if (left >= right) return;
    int pivot = a[left + random.nextInt(right - left + 1)];
    int lt = left, i = left, gt = right;
    while (i <= gt) {
        if (a[i] < pivot) {
            int temp = a[lt]; a[lt++] = a[i]; a[i++] = temp;
        } else if (a[i] > pivot) {
            int temp = a[gt]; a[gt--] = a[i]; a[i] = temp;
        } else i++;
    }
    quickRange(a, left, lt - 1, random);
    quickRange(a, gt + 1, right, random);
}`, '期望时间 O(n log n)，最坏 O(n²)；期望栈深 O(log n)，最坏 O(n)，常见实现不稳定。', ['递归前必须有终止条件，空数组的 right 为 -1。', '基准要保存为值，避免交换后改变比较对象。', '排序会修改输入；需要保留原数组时先复制。']);

  lesson('heap-sort', 'basics', '堆排序', ['heap sort', 'sift down', '建堆'],
    '先建立大顶堆，再不断把最大元素移到末尾，并恢复剩余前缀的堆序。', [215, 347, 23, 295],
    ['下标 i 的左右孩子为 2*i+1 与 2*i+2。大顶堆保证父节点不小于孩子，所以堆顶是全局最大值。', '自底向上建堆时，大多数节点处于较低层，总下沉工作量为 O(n)，不是 n 次 O(log n) 的简单乘积。'],
    ['从 n/2-1 开始向前，对每个非叶节点下沉。', '交换堆顶与当前末尾。', '缩小有效堆范围，再下沉堆顶。'],
    [['[2,5,1] 建大顶堆', '[5,2,1]'], ['把 5 换到末尾', '[1,2] | [5]'], ['恢复堆序并继续', '[1] | [2,5]']],
    `static void heapSort(int[] a) {
    for (int i = a.length / 2 - 1; i >= 0; i--) siftDown(a, i, a.length);
    for (int end = a.length - 1; end > 0; end--) {
        int temp = a[0]; a[0] = a[end]; a[end] = temp;
        siftDown(a, 0, end);
    }
}
static void siftDown(int[] a, int root, int size) {
    while (root < size / 2) {
        int child = root * 2 + 1;
        if (child + 1 < size && a[child + 1] > a[child]) child++;
        if (a[root] >= a[child]) break;
        int temp = a[root]; a[root] = a[child]; a[child] = temp;
        root = child;
    }
}`, '建堆 O(n)，排序 O(n log n)，额外空间 O(1)；常见实现不稳定。', ['有效堆范围 [0,size)，孩子下标必须小于 size。', '大顶堆排序得到升序；最小堆的维护目标不同。']);

  lesson('linked-list', 'basics', '链表 · 指针与虚拟头节点', ['linked list', 'ListNode', 'dummy', '链表反转'],
    '链表不能按下标 O(1) 访问。修改结构时先保存后继，再重连指针；虚拟头节点统一处理头部操作。', [206, 21, 141, 142, 160, 234, 19, 24, 2, 138, 148, 146, 23, 25],
    ['节点保存值和下一个节点的引用。反转时，把当前节点的 next 指向已处理前缀，再继续处理保存的后继。', 'dummy 是额外的虚拟起点，适合删除或合并时可能改变真实头节点的场景。链表与数组的复制语义不同。'],
    ['用 prev、current、next 分清已处理和未处理部分。', '先 next = current.next，再修改 current.next。', '循环结束后 prev 是新头节点。'],
    [['1 → 2 → 3，prev=null', '保存 next=2，把 1.next 改为 null'], ['处理 2', '2 → 1，未处理部分为 3'], ['处理结束', '3 → 2 → 1']],
    `static class ListNode {
    int value;
    ListNode next;
    ListNode(int value) { this.value = value; }
}
static ListNode reverseList(ListNode head) {
    ListNode previous = null, current = head;
    while (current != null) {
        ListNode next = current.next;
        current.next = previous;
        previous = current;
        current = next;
    }
    return previous;
}`, '遍历与反转 O(n)，迭代反转额外空间 O(1)。已知前驱节点时局部增删可为 O(1)。', ['模板字段为 value，适配平台时按节点定义替换；不要混用字段名。', '处理空链表、单节点和头节点变化；反转会改变原结构。', '只比较值无法判断节点是否相交；需要比较引用。']);

  lesson('stack', 'basics', '栈 · 后进先出', ['stack', 'LIFO', '辅助栈'],
    '最后入栈的元素最先处理。适合配对、嵌套结构、撤销操作和保存尚未解决的候选。', [20, 155, 94, 394, 739, 84, 32],
    ['栈记录处理上下文，出栈相当于回到最近保存的位置。Deque 可以承担栈的角色。', '如果需要获取最小值等额外状态，应同步保存辅助信息，而不是每次扫描整栈。'],
    ['同一端 push/pop，peek 只查看。', '处理空栈，再读取或删除栈顶。', '明确保存的是值、下标还是状态对象。'],
    [['push(1), push(2)', '栈顶为 2'], ['peek()', '返回 2，栈不变'], ['pop(), pop()', '依次得到 2、1']],
    `Deque<Integer> stack = new ArrayDeque<>();
stack.push(1);
stack.push(2);
while (!stack.isEmpty()) {
    int value = stack.pop();
    System.out.println(value);
}`, '常规入栈、出栈摊还 O(1)，保存 n 个元素需要 O(n) 空间。', ['空栈 pop 会抛异常。', '栈不是队列，混用 offerLast 与 pop 会改变处理顺序。']);

  lesson('queue', 'basics', '队列 · 先进先出', ['queue', 'FIFO', '层序'],
    '先加入的元素先处理。适合按发现顺序遍历、逐层扩散和任务排队。', [102, 994, 207, 239],
    ['用尾部入队、头部出队实现先进先出。层序遍历每轮先保存队列当前长度，避免把下一层也算入本层。', '图遍历通常在入队时标记已发现，防止同一个节点被多个前驱反复加入。'],
    ['offerLast 加入，pollFirst 取出。', '每层开始时保存 levelSize。', '循环 levelSize 次处理当前层，新元素进入下一层。'],
    [['队列 [A]，保存长度 1', '处理 A，加入 B、C'], ['下一轮长度 2', '处理 B、C，加入下一层'], ['队列为空', '遍历结束']],
    `Deque<Integer> queue = new ArrayDeque<>();
queue.offerLast(1);
queue.offerLast(2);
while (!queue.isEmpty()) {
    int value = queue.pollFirst();
    System.out.println(value);
}`, '普通入队、出队摊还 O(1)，队列空间取决于最大同时等待的元素数。', ['不能在层循环条件中反复读取变化的 queue.size()。', 'ArrayDeque 不允许 null；加入树节点前先判空。']);

  lesson('heap', 'basics', '堆 · 最值与 Top K', ['heap', '优先队列', 'top k'],
    '堆只保证根节点最优，不保证整体排序。保留最大 K 个值时，常用容量 K 的小顶堆保留候选。', [215, 347, 23, 295],
    ['容量 K 的小顶堆中，堆顶是已保留候选中最弱的一项。新值更大时替换堆顶，最终保留下最大的 K 个值。', '双堆可以分别维护数据的较小一半和较大一半；平衡数量与边界顺序后，最值能提供分位信息。'],
    ['先检查 k 的合法性。', '插入新值，超过 k 时移除最小值。', '按需求输出堆中元素；若需要有序结果，再排序或逐个取出。'],
    [['k=2，输入 4、1', '候选 {1,4}，堆顶 1'], ['加入 3', '超过容量，删除 1，保留 {3,4}'], ['加入 2', '删除 2，候选不变']],
    `static List<Integer> largestK(int[] values, int k) {
    if (k < 0 || k > values.length) throw new IllegalArgumentException();
    PriorityQueue<Integer> heap = new PriorityQueue<>();
    for (int value : values) {
        heap.offer(value);
        if (heap.size() > k) heap.poll();
    }
    List<Integer> result = new ArrayList<>(heap);
    result.sort(Comparator.reverseOrder());
    return result;
}`, '维护候选 O(n log(k+1))，结果排序 O(k log(k+1))，额外空间 O(k)。', ['k=0 返回空结果；k>n 时按契约拒绝。', '保留最大 K 项使用小顶堆；目标和堆的方向需要配合。']);

  lesson('tree', 'basics', '二叉树 · 遍历与节点状态', ['tree', 'TreeNode', '前序', '中序', '后序', 'BST'],
    '把树问题拆成当前节点、左子树、右子树。前中后序取决于处理当前节点发生在递归之前、之间还是之后。', [94, 104, 226, 101, 543, 102, 108, 98, 230, 199, 105, 114, 437, 236, 124],
    ['前序适合先处理根；中序在二叉搜索树中得到有序序列；后序适合先得到子树结果再合并。', '普通二叉树不具备 BST 的排序约束。判断 BST 需要整棵子树的范围约束，不能只检查直接孩子。'],
    ['空节点是递归基例。', '根据任务选择前、中、后序。', '区分传给孩子的参数、孩子返回的结果、维护的全局答案。'],
    [['根 2，左孩子 1，右孩子 3', '前序 2,1,3'], ['先左、再根、再右', '中序 1,2,3'], ['先左右、再根', '后序 1,3,2']],
    `static class TreeNode {
    int value;
    TreeNode left, right;
    TreeNode(int value) { this.value = value; }
}
static void inorder(TreeNode root, List<Integer> values) {
    if (root == null) return;
    inorder(root.left, values);
    values.add(root.value);
    inorder(root.right, values);
}`, '遍历 O(n)，递归空间 O(h)；平衡树 h≈log n，退化链状树 h=n。', ['空树需要正常返回。', '递归深度过大可能栈溢出；可用显式栈。', '多次调用时避免残留上次的全局状态。']);

  lesson('graph', 'basics', '图 · 邻接表与访问标记', ['graph', 'adjacency list', '网格', 'visited'],
    '图可能有环、重复路径与不连通分量。用邻接表表达边，用访问标记防止重复处理。', [200, 994, 207, 79],
    ['邻接表给每个节点保存出边。无向图一条边需要双向加入，有向图只按方向加入。', '网格可视为隐式图，邻居由上下左右等规则即时计算，无需真的建立所有邻接表。'],
    ['明确节点编号、边方向和是否有权重。', '为所有节点初始化列表，包括孤立节点。', '有环图遍历时维护 visited；搜索所有分量要遍历全部起点。'],
    [['无向边 0—1、1—2', '0:[1]，1:[0,2]，2:[1]'], ['只有 visited[0]=true', '其他节点通过边逐步发现'], ['还有孤立节点 3', '从 0 遍历不会自动访问 3']],
    `static List<List<Integer>> undirectedGraph(int n, int[][] edges) {
    List<List<Integer>> graph = new ArrayList<>();
    for (int i = 0; i < n; i++) graph.add(new ArrayList<>());
    for (int[] edge : edges) {
        graph.get(edge[0]).add(edge[1]);
        graph.get(edge[1]).add(edge[0]);
    }
    return graph;
}`, '邻接表空间 O(V+E)，DFS/BFS 通常 O(V+E)；网格遍历通常与格子数成正比。', ['模板假定端点在 [0,n)；外部输入要先验证范围。', 'visited 的含义必须明确：全局已访问与当前路径占用并不相同。']);

  lesson('trie', 'basics', 'Trie · 前缀树', ['prefix tree', '字典树', '前缀'],
    '按字符逐层建立节点，共享相同前缀。查完整词时检查结束标记；查前缀只需确认路径存在。', [208, 79, 139],
    ['同一前缀的词共享一段路径。“存在路径”与“某个词在此结束”是两个不同状态。', '下面用 Map 保存孩子，避免预设只含 a-z；按 char 处理 UTF-16 代码单元。字符集固定时也可用数组。'],
    ['插入时逐字符创建孩子。', '最后节点标记 word=true。', '查询路径，完整词还要检查 word。'],
    [['插入 cat 与 car', 'c → a 是公共前缀'], ['查 ca', '路径存在，但不是完整词'], ['查 cat', '路径末尾 word=true']],
    `static class TrieNode {
    Map<Character, TrieNode> children = new HashMap<>();
    boolean word;
}
static void insertWord(TrieNode root, String word) {
    TrieNode current = root;
    for (char ch : word.toCharArray()) {
        current = current.children.computeIfAbsent(ch, key -> new TrieNode());
    }
    current.word = true;
}
static boolean containsWord(TrieNode root, String word) {
    TrieNode current = root;
    for (char ch : word.toCharArray()) {
        current = current.children.get(ch);
        if (current == null) return false;
    }
    return current.word;
}`, '单次插入与查询期望 O(L)，L 是字符串长度；空间与新建前缀节点数有关。', ['空字符串是否允许，按题目定义；此模板会在根节点记录空词。', '大小写不同默认是不同字符，不要在没有需求时自动转小写。']);

  lesson('matrix', 'basics', '矩阵 · 坐标、边界与访问', ['matrix', '二维数组', '方向数组', '转置'],
    '用行列坐标表达位置，先检查边界再读取格子。按问题选择方向遍历、边界收缩或坐标变换。', [73, 54, 48, 240, 74, 200, 994, 79, 62, 64],
    ['矩阵可视为二维数组或隐式图。上下左右移动对应固定方向增量；旋转和转置则通过坐标映射定义。', '螺旋遍历维护 top/bottom/left/right，并在收缩后重新检查区间。Java 的 int[][] 可以是不规则行长，刷题的矩形前提要明确。'],
    ['确认空矩阵、行数 rows、列数 cols。', '用 nr=r+dr、nc=c+dc 计算候选位置。', '验证边界，再检查是否访问过或满足条件。'],
    [['2×3 矩阵，位置 (0,1)', '上方 (-1,1) 越界'], ['向左、右、下移动', '(0,0)、(0,2)、(1,1) 合法'], ['转置 (r,c)', '对应新矩阵 (c,r)']],
    `static int[][] transpose(int[][] matrix) {
    if (matrix.length == 0) return new int[0][0];
    int rows = matrix.length, cols = matrix[0].length;
    int[][] result = new int[cols][rows];
    for (int r = 0; r < rows; r++) {
        if (matrix[r].length != cols) throw new IllegalArgumentException();
        for (int c = 0; c < cols; c++) result[c][r] = matrix[r][c];
    }
    return result;
}`, '扫描矩阵 O(rows×cols)，此转置模板额外空间同为 O(rows×cols)。', ['在 matrix[0] 之前先判断行数。', '长方形与正方形的原地坐标变换条件不同。', '只有一个全局单调顺序时才能直接展平二分，不能仅凭每行每列分别有序就套用。']);

  lesson('hash-count', 'patterns', '哈希计数与分组', ['frequency', '计数', '分组', '键设计'],
    '把“查找过去的信息”变为键值查询。先决定键代表什么，再决定值保存次数、位置、列表还是状态。', [1, 49, 128, 560, 347, 437, 73, 41],
    ['计数表保存每个类别出现次数；分组表保存等价关系相同的元素。键必须能准确表达你希望区分的类别。', '在逐项扫描中，先查询还是先加入会决定是否使用了当前元素，以及能否正确处理重复值。'],
    ['明确相等条件和键的表示。', '用 Map 维护所需历史信息。', '根据问题决定先查后写，或先写后查。'],
    [['输入 blue, red, blue', 'blue 的次数从 1 增至 2'], ['用长度作为字符串分组键', 'cat 与 dog 会同组，但不代表字符相同'], ['键表示更细的等价关系', '分组结果才符合问题定义']],
    `static Map<String, Integer> frequencies(List<String> values) {
    Map<String, Integer> counts = new HashMap<>();
    for (String value : values) counts.merge(value, 1, Integer::sum);
    return counts;
}`, '哈希分布合理时，扫描 n 项的期望时间 O(n)，空间 O(k)，k 为不同键数量；构造键的成本需另计。', ['字符串排序作为键时，要把排序成本计入复杂度。', 'null 值和缺失键含义不同；频率表通常不存 null。', '使用数组计数前确认字符或数值的范围。']);

  lesson('two-pointers', 'patterns', '双指针 · 相向与同向', ['two pointers', '左右指针', '读写指针', '原地压缩'],
    '两个位置共同维护一个区间或读写关系。指针移动方向需要由有序性、约束或处理进度证明。', [283, 11, 15, 189, 75, 31, 42, 234, 160],
    ['相向指针从两端缩小区间；同向读写指针把满足条件的元素写入前缀。重要的是每次移动为什么不会漏掉答案。', '以下示例仅演示过滤保留值：write 指向下一个写入位置，read 扫描全部输入。返回的新长度定义有效前缀。'],
    ['定义两个指针及有效区域。', '每次至少推进一个指针，保证终止。', '原地操作时确保不会覆盖尚未读取的值。'],
    [['[3,-1,2]，write=0', '保留 3，write=1'], ['读到 -1', '跳过，write 不动'], ['读到 2', '写入下标 1；有效前缀 [3,2]']],
    `static int keepNonNegative(int[] values) {
    int write = 0;
    for (int read = 0; read < values.length; read++) {
        if (values[read] >= 0) values[write++] = values[read];
    }
    return write;
}`, '若每个指针最多移动 n 次，时间 O(n)，额外空间 O(1)。相向查找可能需要先排序，排序成本另计。', ['返回新长度不代表数组物理长度改变。', '有些区间算法不适合相向缩小，必须证明移动规则。', '乘积、面积、求和可能需要 long。']);

  lesson('fast-slow', 'patterns', '快慢指针 · 中点与环', ['fast slow', 'Floyd', 'cycle', '环检测'],
    '让指针以不同速度移动，利用路径结构判断中点或是否存在环。也适用于定义了唯一后继的状态序列。', [141, 142, 234, 19, 287, 148],
    ['无环链中，快指针最终遇到 null；有环时，进入环后的相对速度会使快慢指针相遇。相遇位置通常不是环入口。', '找中点时，偶数长度返回哪个中点取决于初始化与循环条件，必须与后续操作匹配。'],
    ['slow 每轮走一步，fast 走两步。', '先检查 fast 与 fast.next，避免访问空引用。', '判断引用相等，不是节点值相等。'],
    [['1 → 2 → 3 → 2，初始都在 1', '第一轮 slow=2，fast=3'], ['第二轮', 'slow=3，fast=3，相遇说明有环'], ['无环链表', 'fast 先到达末尾']],
    `static class Node {
    int value; Node next;
    Node(int value) { this.value = value; }
}
static boolean hasCycle(Node head) {
    Node slow = head, fast = head;
    while (fast != null && fast.next != null) {
        slow = slow.next;
        fast = fast.next.next;
        if (slow == fast) return true;
    }
    return false;
}`, '时间 O(n)，额外空间 O(1)。状态序列必须有确定的后继函数。', ['不要在进入循环前把初始 slow==fast 当作检测结果。', '重复的节点值不代表存在环。', '空链、单节点、自环都要覆盖。']);

  lesson('sliding-window', 'patterns', '滑动窗口 · 连续区间', ['sliding window', '子串', '子数组', '窗口'],
    '维护连续区间，并在边界移动时增量更新统计。能否只让左边界向右移动，取决于约束的单调性。', [3, 438, 76, 239],
    ['右端扩大窗口，左端修复约束。每个元素最多进出一次时，就能把重复扫描降为线性维护。', '定长窗口与可变窗口不同。求最长合法区间通常先修复再更新答案；求最短覆盖通常在合法时持续收缩。含负数的和约束不一定适合这种单调收缩。'],
    ['明确窗口区间，例如 [left,right]。', '加入右端元素，更新统计。', '约束不满足时移动左端，撤销离开元素的贡献。'],
    [['[2,5,1,4]，固定长度 2', '初始和 7'], ['右移一格', '减去 2，加上 1，和 6'], ['再右移', '减去 5，加上 4，和 5']],
    `static long[] fixedWindowSums(int[] values, int k) {
    if (k <= 0 || k > values.length) throw new IllegalArgumentException();
    long[] sums = new long[values.length - k + 1];
    long sum = 0;
    for (int right = 0; right < values.length; right++) {
        sum += values[right];
        if (right >= k) sum -= values[right - k];
        if (right >= k - 1) sums[right - k + 1] = sum;
    }
    return sums;
}`, '模板 O(n) 时间；除输出数组外，维护统计为 O(1) 空间。复杂窗口的统计结构需另计。', ['窗口必须连续，不能直接解决任意子序列问题。', '移动左端时不能忘记更新频次或其他状态。', '先确定长度为 0 是否有意义；此模板拒绝非正窗口长度。']);

  lesson('prefix-sum', 'patterns', '前缀和与前后缀状态', ['prefix sum', '区间和', '前缀积', 'suffix'],
    '预先汇总从开头到每个边界的状态，快速回答区间查询。用 n+1 个位置让空前缀也有明确表示。', [560, 437, 238, 53, 152],
    ['定义 prefix[i] 为前 i 个元素之和，因此 [left,right) 的和是 prefix[right]-prefix[left]。同样的“左右贡献分开维护”可推广到前后缀积、最值等状态，但并非所有运算都有减法逆运算。', '若需要查找某个历史前缀，可以结合哈希计数。扫描顺序决定历史集合是否包含当前前缀。'],
    ['prefix[0]=0，数组长度 n+1。', 'prefix[i+1]=prefix[i]+a[i]。', '查询左闭右开 [left,right)，返回差值。'],
    [['a=[2,-1,4]', 'prefix=[0,2,1,5]'], ['查询 [1,3)', 'prefix[3]-prefix[1]=3'], ['查询空区间 [2,2)', '结果 0']],
    `static long[] prefixSums(int[] values) {
    long[] prefix = new long[values.length + 1];
    for (int i = 0; i < values.length; i++) prefix[i + 1] = prefix[i] + values[i];
    return prefix;
}
static long rangeSum(long[] prefix, int left, int right) {
    if (left < 0 || left > right || right >= prefix.length) throw new IllegalArgumentException();
    return prefix[right] - prefix[left];
}`, '预处理 O(n)，每次查询 O(1)，空间 O(n)。', ['数组元素可为负数；前缀和仍成立。', '注意 n 与 n+1 下标对应关系。', '累计和可能超出 int，使用 long 并检查题目范围。']);

  lesson('recursion', 'patterns', '递归 · 基例、缩小与返回值', ['recursion', '递归栈', 'base case'],
    '把当前任务交给规模更小的同类任务，再组合返回结果。需要基例、规模缩小规则和明确的函数含义。', [104, 226, 101, 543, 98, 105, 236, 124, 148, 394],
    ['先用一句话定义函数返回什么，再写基例和递推关系。例如 power(base,n) 返回 base 的 n 次幂，递归问题是 n/2 次幂。', '不要用递归调用来代替思考状态。重复子问题需要缓存或改用动态规划；过深调用需要迭代方案。'],
    ['确定参数、返回值和输入契约。', '写最小规模的直接结果。', '递归调用必须靠近基例，再组合结果。'],
    [['power(2,5)', '先计算 power(2,2)'], ['power(2,2)', '先计算 power(2,1)，继续到指数 0'], ['向上返回', '1 → 2 → 4 → 32']],
    `static long power(long base, int exponent) {
    if (exponent < 0) throw new IllegalArgumentException();
    if (exponent == 0) return 1;
    long half = power(base, exponent / 2);
    long square = Math.multiplyExact(half, half);
    return exponent % 2 == 0 ? square : Math.multiplyExact(square, base);
}`, '此幂模板 O(log(n+1)) 时间和递归栈空间；普通递归的复杂度取决于分支数和状态数量。', ['模板在 long 溢出时抛异常，而不是悄悄返回错误结果。', '基例必须覆盖空结构或最小输入。', '递归层数大时注意 StackOverflowError。']);

  lesson('divide-conquer', 'patterns', '分治 · 分解、求解、合并', ['divide and conquer', '分治法'],
    '将问题拆为较小子问题，分别求解，再合并。归并排序、快速排序和快速幂展示了不同合并成本。', [148, 23, 108, 105, 215, 53],
    ['只有子问题覆盖原问题，并能正确合并答案时，分治才成立。归并排序的合并为线性扫描；快速排序把主要工作放在划分阶段。', '通过 T(n)=子问题成本+当前层成本分析总时间，不要只看递归层数。'],
    ['定义子区间并确保无遗漏、无重复。', '规模较小时直接求解。', '组合子问题结果，明确合并成本。'],
    [['求 [5,1,4,2] 的最小值', '拆为 [5,1] 与 [4,2]'], ['子结果', '左侧 1，右侧 2'], ['合并', 'min(1,2)=1']],
    `static int rangeMin(int[] values, int left, int right) {
    if (left < 0 || left >= right || right > values.length) throw new IllegalArgumentException();
    if (right - left == 1) return values[left];
    int mid = left + (right - left) / 2;
    return Math.min(rangeMin(values, left, mid), rangeMin(values, mid, right));
}`, '此示例 T(n)=2T(n/2)+O(1)，总时间 O(n)，递归空间 O(log n)。直接迭代求最小值也为 O(n)，分治示例主要用于理解结构。', ['不是使用递归就一定更快；比较合并成本和普通遍历。', '区间采用左闭右开，空区间在此模板中被拒绝。']);

  lesson('dfs', 'patterns', 'DFS · 深度优先遍历', ['depth first search', '深搜', '深度优先'],
    '沿一条路径深入，再返回探索其他分支。适合连通性、树形信息汇总和路径探索。', [200, 94, 104, 226, 101, 543, 98, 105, 114, 437, 236, 124, 79],
    ['栈体现“最近发现的候选先处理”，递归调用栈也能实现同样的探索顺序。图可能有环，需要标记已发现。', '普通图连通遍历使用全局 visited；枚举路径时可能需要在退出当前路径后撤销占用，两者不能混同。'],
    ['发现节点时标记，避免重复入栈。', '取出一个候选，处理并加入未发现邻居。', '需要遍历所有分量时，对所有未访问起点重复此过程。'],
    [['0 连接 1、2；1 连接 3', '从 0 入栈并标记'], ['按一个分支深入', '可能访问 0→1→3，再回到 2'], ['重复边或环', '已发现节点不再加入']],
    `static List<Integer> depthFirst(List<List<Integer>> graph, int start) {
    boolean[] seen = new boolean[graph.size()];
    List<Integer> order = new ArrayList<>();
    Deque<Integer> stack = new ArrayDeque<>();
    stack.push(start); seen[start] = true;
    while (!stack.isEmpty()) {
        int current = stack.pop();
        order.add(current);
        for (int next : graph.get(current)) {
            if (!seen[next]) { seen[next] = true; stack.push(next); }
        }
    }
    return order;
}`, '遍历可达子图 O(V+E)，visited 与显式栈空间 O(V)。', ['模板假定合法起点和边端点。', '遍历次序受邻居排列与压栈顺序影响，不能拿某个次序当通用保证。', '需要递归退出时的后序信息时，显式栈还要保存处理阶段。']);

  lesson('bfs', 'patterns', 'BFS · 层次与无权最短路', ['breadth first search', '广搜', '广度优先', '多源 BFS'],
    '按距离逐层扩展。边权相同时，首次发现节点的路径长度就是最短步数；多源情况将所有起点先加入队列。', [102, 994, 207, 200],
    ['先进先出队列保证更近的节点先处理。入队时立即标记，可以避免同一层的多个节点重复发现同一候选。', '普通 BFS 不能直接处理任意非负权重最短路。多源 BFS 的各个起点初始距离均为 0。'],
    ['将未发现距离初始化为 -1。', '起点距离设为 0 并入队。', '第一次发现邻居时设 dist[next]=dist[current]+1，再入队。'],
    [['0 连接 1、2；1 连接 3', 'dist[0]=0'], ['第一层发现 1、2', '距离都为 1'], ['从 1 发现 3', 'dist[3]=2']],
    `static int[] shortestSteps(List<List<Integer>> graph, int start) {
    int[] distance = new int[graph.size()];
    Arrays.fill(distance, -1);
    Deque<Integer> queue = new ArrayDeque<>();
    distance[start] = 0; queue.offerLast(start);
    while (!queue.isEmpty()) {
        int current = queue.pollFirst();
        for (int next : graph.get(current)) {
            if (distance[next] == -1) {
                distance[next] = distance[current] + 1;
                queue.offerLast(next);
            }
        }
    }
    return distance;
}`, '时间 O(V+E)，距离表和队列 O(V)。', ['不可达节点保留 -1，不应误当作距离 0。', '每一步成本不同就需要其他最短路算法。', '多源场景先同时初始化全部起点，不能逐起点独立重复整张图。']);

  lesson('backtracking', 'patterns', '回溯 · 选择、探索、撤销', ['backtracking', '剪枝', '排列', '组合', '子集'],
    '枚举决策路径，每次做一个选择，探索后恢复现场。剪枝只跳过可以证明不会产生有效结果的分支。', [78, 46, 17, 39, 22, 131, 79, 51],
    ['路径保存已做的选择，参数描述剩余候选，终止条件决定何时收集答案。撤销必须恢复本层进入之前的状态。', '组合常用起始下标避免重复顺序；排列常用 used 防止重复使用同一位置；候选值重复时还要按题意去重。'],
    ['写出状态、候选、结束条件。', '选择一个候选并更新路径。', '递归后撤销路径和占用状态。'],
    [['枚举长度 2 的 0/1 序列', '先选 0，再选 0：得到 00'], ['撤销末尾 0，再选 1', '得到 01'], ['撤销首位并选 1', '继续得到 10、11']],
    `static List<String> binaryStrings(int length) {
    if (length < 0) throw new IllegalArgumentException();
    List<String> result = new ArrayList<>();
    buildBinary(length, new StringBuilder(), result);
    return result;
}
static void buildBinary(int remaining, StringBuilder path, List<String> result) {
    if (remaining == 0) { result.add(path.toString()); return; }
    for (char bit = '0'; bit <= '1'; bit++) {
        path.append(bit);
        buildBinary(remaining - 1, path, result);
        path.setLength(path.length() - 1);
    }
}`, '此枚举产生 2^n 个长度 n 的字符串，时间与输出空间 O(n×2^n)，递归与路径辅助空间 O(n)。', ['保存可变列表路径要复制；字符串用 toString 快照。', '撤销状态不能遗漏，也不能误删上层的选择。', '空选择的结果可能是一个空序列，不一定是空结果列表。']);

  lesson('greedy', 'patterns', '贪心 · 局部选择与证明', ['greedy', '交换论证', '覆盖', '区间选择'],
    '每一步固定一个局部选择，并证明它不会损失全局最优性。能做出直觉选择不等于贪心一定成立。', [121, 55, 45, 763, 11],
    ['常用证明是交换论证：把某个最优解的第一步替换为贪心选择，结果不会更差，再递归处理剩余问题。', '下面演示最大数量的不重叠活动：优先选择最早结束的活动，给后续留下尽可能多的可用时间。区间按 [start,end) 定义，端点相接可以兼容。'],
    ['先明确优化目标和每次选择。', '给出安全选择的证明或反例检查。', '排序后维护当前状态，避免把局部最大值直接当全局答案。'],
    [['活动 [0,5)、[0,2)、[2,4)', '最早结束的是 [0,2)'], ['再选 [2,4)', '可安排 2 个活动'], ['若先选最长活动 [0,5)', '只能安排 1 个，说明另一种直觉失败']],
    `static int activityCount(int[][] activities) {
    int[][] ordered = activities.clone();
    Arrays.sort(ordered, Comparator.comparingInt(item -> item[1]));
    long end = Long.MIN_VALUE;
    int count = 0;
    for (int[] activity : ordered) {
        if (activity[0] >= end) { count++; end = activity[1]; }
    }
    return count;
}`, '示例排序 O(n log n)，扫描 O(n)，复制外层数组 O(n) 空间。', ['模板假定合法区间 start < end。', '任意面额的最少硬币数不一定能贪心；例如 1、3、4 凑 6，先取 4 会失败。', '如果局部选择无法证明安全，考虑 DP 或搜索。']);

  lesson('dynamic-programming', 'patterns', '动态规划 · 状态、转移与初始化', ['dp', 'dynamic programming', '背包', '一维 DP', '二维 DP'],
    '用可复用状态避免重复求解。先准确描述 dp 的含义，再确定转移、初始值、遍历顺序和答案位置。', [53, 70, 118, 198, 62, 64, 279, 322, 139, 300, 152, 416, 1143, 5, 72, 32, 124],
    ['一个状态必须包含未来决策所需的信息；相同状态下的历史路径无需重复计算。最值、计数、可行性问题有不同初始化规则。', '0/1 背包每件物品只能选一次，压缩成一维后容量倒序，避免本轮刚更新的结果又被用于同一物品。完全背包的复用规则不同。'],
    ['写出“dp[x] 表示什么”，注明恰好或至多。', '列出最后一步的所有选择，得到转移。', '按依赖关系初始化并遍历，最后定位答案。'],
    [['容量 4；物品重量 2、价值 3', '从 c=4 向下更新'], ['处理 c=2', 'dp[2]=3'], ['如果改为正序', 'c=4 会使用刚更新的 dp[2]，错误地选了同一件两次']],
    `static int zeroOneKnapsack(int capacity, int[] weights, int[] values) {
    if (capacity < 0 || weights.length != values.length) throw new IllegalArgumentException();
    int[] dp = new int[capacity + 1];
    for (int i = 0; i < weights.length; i++) {
        if (weights[i] <= 0) throw new IllegalArgumentException();
        for (int c = capacity; c >= weights[i]; c--) {
            dp[c] = Math.max(dp[c], dp[c - weights[i]] + values[i]);
        }
    }
    return dp[capacity];
}`, '此模板时间 O(n×capacity)，额外空间 O(capacity)；dp[c] 表示容量至多 c 时的最大价值，可不选物品。', ['恰好装满需要标记不可达状态，不能把所有位置都设为 0。', '二维序列 DP 常需要保留上一行或左上角，空间压缩前先检查依赖。', '金额、容量很大时，此复杂度未必可行；价值或计数溢出也需检查。']);

  lesson('monotonic-stack', 'patterns', '单调栈 · 最近更大或更小', ['monotonic stack', 'next greater', '单调递增', '单调递减'],
    '栈中保存尚未找到答案的候选下标。当前元素满足条件时，依次解决栈顶，再把自己作为新候选。', [739, 84, 42],
    ['求右侧第一个严格更大元素时，栈保存值非递增的下标。当前值大于栈顶值，就能成为栈顶的第一个更大元素，因为栈顶此前一直未遇到合适值。', '最大矩形等问题需要处理边界宽度和相等元素，比较符号以及是否用哨兵都必须与定义一致。'],
    ['栈保存下标，便于计算距离与查值。', '当前值满足弹栈条件时，记录被弹下标的答案。', '将当前下标压栈；未找到答案的项保留约定缺省值。'],
    [['输入 [2,1,3]', '先保存下标 0、1'], ['读到 3', '弹出 1：答案为下标 2；再弹出 0'], ['处理结束', 'next=[2,2,-1]']],
    `static int[] nextGreaterIndex(int[] values) {
    int[] next = new int[values.length];
    Arrays.fill(next, -1);
    Deque<Integer> stack = new ArrayDeque<>();
    for (int i = 0; i < values.length; i++) {
        while (!stack.isEmpty() && values[i] > values[stack.peek()]) next[stack.pop()] = i;
        stack.push(i);
    }
    return next;
}`, '每个下标最多入栈、出栈各一次，总时间 O(n)，额外空间 O(n)。', ['“严格更大”与“大于等于”需要不同弹栈条件。', '保存值而不保存下标可能丢失距离与重复值位置信息。', '不要按 while 嵌套 for 的外观直接判断为 O(n²)，要统计总出入次数。']);

  lesson('monotonic-queue', 'patterns', '单调队列 · 窗口最值候选', ['monotonic queue', 'deque', '滑动最值'],
    '维护一个按值单调排列、按下标递增的候选队列。队首提供当前窗口的最优值，下标负责判断过期。', [239],
    ['新值比旧的尾部候选更优且过期更晚时，旧候选不会再成为答案，可以永久移除。', '候选按下标记录才能同时处理重复值和过期；这与普通先进先出队列的功能不同。'],
    ['先从队首移除过期下标。', '从队尾移除被新值支配的候选。', '加入新下标，窗口形成后读取队首。'],
    [['窗口长度 2，输入 [3,1,4]', '读到 3，候选 [0]'], ['读到 1', '候选 [0,1]，最大值 3'], ['读到 4', '0 过期，1 被 4 支配；候选 [2]']],
    `Deque<Integer> candidates = new ArrayDeque<>();
int[] values = {3, 1, 4};
int windowSize = 2;
for (int right = 0; right < values.length; right++) {
    int left = right - windowSize + 1;
    while (!candidates.isEmpty() && candidates.peekFirst() < left) candidates.pollFirst();
    while (!candidates.isEmpty() && values[candidates.peekLast()] <= values[right]) candidates.pollLast();
    candidates.offerLast(right);
    if (left >= 0) System.out.println(values[candidates.peekFirst()]);
}`, '每个下标最多入队、出队一次，时间 O(n)，辅助空间 O(k)，k 为窗口长度。', ['这是维护固定窗口候选的示例，不包含平台题目的完整函数。', '窗口参数需满足 1≤k≤n；过期判断作用于下标。', '相等值移除旧项可保留更晚过期的候选，也可按特定需求保留等值项。']);

  lesson('bitwise', 'patterns', '位运算 · 异或与掩码', ['bit manipulation', 'xor', '位与', '位或', '移位'],
    '把整数视为位集合。异或适合奇偶抵消，位与检查共同的 1，掩码表达某个集合状态。', [136, 169, 78],
    ['异或满足 x^x=0、x^0=x，且可交换、可结合，因此相同值成对出现时可以抵消。适用前提是题目中的出现次数结构符合这个规则。', 'n & (n-1) 清除最低有效的一个 1；反复清除可以计算二进制中的 1 个数。Java int 为 32 位，>> 保留符号，>>> 用零填充。'],
    ['明确每个比特代表的含义。', '用 (mask & (1 << bit)) != 0 判断是否设置。', '需要超过 31 位的状态时使用 long 等合适类型。'],
    [['5 的二进制为 0101', '5 & 4 = 0100，移除最低位 1'], ['4 & 3', '得到 0000'], ['循环两次', '说明 5 含两个 1']],
    `static int countSetBits(int value) {
    int count = 0;
    while (value != 0) { value &= value - 1; count++; }
    return count;
}`, '时间与置位数成正比；对固定 32 位 int，最多 32 次，额外空间 O(1)。', ['Java int 的移位距离只使用低 5 位；1 << 32 并非预期的第 32 位。', '长整型掩码使用 1L << bit。', '异或不能处理任意频次的所有去重任务。']);

  lesson('topological-sort', 'patterns', '拓扑排序 · 依赖与入度', ['topological sort', 'Kahn', '有向无环图', 'DAG'],
    '对有向依赖图排序，使每条边的前驱先于后继。不断取出入度为 0 的节点，并减少后继入度。', [207],
    ['入度表示尚未处理的前置依赖数。当前入度 0 的节点可以安全处理，因为它的所有前驱已完成。', '若处理数量少于节点总数，剩余节点受到环形依赖阻挡；有环图不存在拓扑顺序。多个合法顺序可能同时存在。'],
    ['统计每个节点入度。', '所有入度 0 的节点同时入队。', '出队节点的每条出边让后继入度减 1，降为 0 时入队。'],
    [['边 0→2、1→2', '入度 [0,0,2]，起始队列 [0,1]'], ['处理 0，再处理 1', '节点 2 的入度依次变为 1、0'], ['2 入队并完成', '得到合法顺序 [0,1,2]']],
    `static List<Integer> topologicalOrder(List<List<Integer>> graph) {
    int[] indegree = new int[graph.size()];
    for (List<Integer> neighbors : graph) for (int next : neighbors) indegree[next]++;
    Deque<Integer> queue = new ArrayDeque<>();
    for (int i = 0; i < indegree.length; i++) if (indegree[i] == 0) queue.offerLast(i);
    List<Integer> order = new ArrayList<>();
    while (!queue.isEmpty()) {
        int current = queue.pollFirst(); order.add(current);
        for (int next : graph.get(current)) if (--indegree[next] == 0) queue.offerLast(next);
    }
    if (order.size() != graph.size()) throw new IllegalArgumentException("Cycle detected");
    return order;
}`, '时间 O(V+E)，额外入度表和队列 O(V)。', ['先明确边表示“先完成 u 再完成 v”，方向不能写反。', '无向图不能直接套此模板。', '重复边的入度统计与减入度次数需要对应。']);

  const catalog = { categories, topics };
  if (typeof module !== 'undefined' && module.exports) module.exports = catalog;
  if (typeof window !== 'undefined') window.Hot100Knowledge = catalog;
})();
