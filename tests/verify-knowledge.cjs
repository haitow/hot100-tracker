const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const catalog = require('../public/knowledge-data.js');

async function main() {
  const project = path.resolve(__dirname, '..');
  const plan = await fs.readFile(path.join(project, 'hot100-50-day-plan.md'), 'utf8');
  const problemIds = [...plan.matchAll(/^- \[ \] .+?\[(\d+)\./gm)].map((match) => Number(match[1]));
  assert.equal(problemIds.length, 100);
  const categories = new Set(catalog.categories.map((item) => item.id));
  assert.equal(categories.size, 3);
  const ids = new Set();
  const snippets = [];
  for (const topic of catalog.topics) {
    assert(categories.has(topic.category));
    assert.match(topic.id, /^[a-z][a-z0-9-]*$/);
    assert(!ids.has(topic.id), `Duplicate topic ${topic.id}`);
    ids.add(topic.id);
    assert(topic.summary.length > 20);
    assert(topic.sections.length >= 4);
    const sections = new Set(['references']);
    for (const section of topic.sections) {
      assert(!sections.has(section.id), `Duplicate section ${topic.id}/${section.id}`);
      sections.add(section.id);
      if (section.rows) section.rows.forEach((row) => assert.equal(row.length, section.headers.length));
      if (topic.category === 'api' && section.id === 'quick') {
        assert.deepEqual(section.headers, ['方法名', '功能描述']);
        const methods = new Set();
        section.rows.forEach(([method, description]) => {
          assert(!method.includes(' / '), `Grouped methods in ${topic.id}: ${method}`);
          assert(!methods.has(method), `Duplicate method ${topic.id}: ${method}`);
          methods.add(method);
          assert(description.length > 0 && description.length <= 40, `Verbose method description ${topic.id}: ${method}`);
        });
      }
      if (section.code) snippets.push({ topic, section, name: `Snippet${snippets.length}` });
    }
    topic.problems.forEach((id) => assert(problemIds.includes(id), `Unknown problem ${id}`));
    (topic.sources ?? []).forEach((source) => assert.equal(new URL(source.url).protocol, 'https:'));
  }
  problemIds.forEach((id) => assert(catalog.topics.some((topic) => topic.problems.includes(id)), `Unmapped problem ${id}`));

  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'hot100-java-'));
  try {
    const files = [];
    for (const snippet of snippets) {
      const code = /^static\s/m.test(snippet.section.code)
        ? snippet.section.code : `public static void main(String[] args) {\n${snippet.section.code}\n}`;
      const file = path.join(temp, `${snippet.name}.java`);
      await fs.writeFile(file, `import java.util.*;\nclass ${snippet.name} {\n${code}\n}\n`);
      files.push(file);
    }
    const nameOf = (id) => {
      const snippet = snippets.find((item) => item.topic.id === id && item.section.id === 'template');
      assert(snippet, `Missing template ${id}`);
      return snippet.name;
    };
    const sorting = ['bubble-sort', 'selection-sort', 'insertion-sort', 'merge-sort', 'quick-sort', 'heap-sort'];
    const methods = ['bubbleSort', 'selectionSort', 'insertionSort', 'mergeSort', 'quickSort', 'heapSort'];
    const checks = `import java.util.*;
class AlgorithmChecks {
    static void check(boolean condition) { if (!condition) throw new AssertionError(); }
    public static void main(String[] args) {
        Random random = new Random(7);
        for (int trial = 0; trial < 180; trial++) {
            int[] values = new int[trial % 31];
            for (int i = 0; i < values.length; i++) values[i] = random.nextInt(13) - 6;
            if (values.length > 2 && trial % 5 == 0) { values[0] = Integer.MIN_VALUE; values[1] = Integer.MAX_VALUE; }
            int[] expected = values.clone(); Arrays.sort(expected);
            ${sorting.map((id, i) => `{ int[] actual = values.clone(); ${nameOf(id)}.${methods[i]}(actual); check(Arrays.equals(actual, expected)); }`).join('\n            ')}
            for (int target = -8; target <= 8; target++) {
                int expectedPosition = 0;
                while (expectedPosition < expected.length && expected[expectedPosition] < target) expectedPosition++;
                check(${nameOf('binary-search')}.lowerBound(expected, target) == expectedPosition);
            }
        }
        long[] prefix = ${nameOf('prefix-sum')}.prefixSums(new int[]{2,-1,4});
        check(${nameOf('prefix-sum')}.rangeSum(prefix,1,3) == 3);
        check(${nameOf('prefix-sum')}.rangeSum(prefix,2,2) == 0);
        check(${nameOf('dynamic-programming')}.zeroOneKnapsack(4,new int[]{2},new int[]{3}) == 3);
        check(${nameOf('dynamic-programming')}.zeroOneKnapsack(5,new int[]{2,3},new int[]{3,4}) == 7);
        check(${nameOf('dynamic-programming')}.zeroOneKnapsack(0,new int[]{2},new int[]{3}) == 0);
        check(${nameOf('backtracking')}.binaryStrings(0).equals(Arrays.asList("")));
        check(${nameOf('backtracking')}.binaryStrings(2).equals(Arrays.asList("00","01","10","11")));
        check(${nameOf('heap')}.largestK(new int[]{4,1,3,2},2).equals(Arrays.asList(4,3)));
        check(${nameOf('heap')}.largestK(new int[]{4,1},0).isEmpty());
        check(Arrays.equals(${nameOf('monotonic-stack')}.nextGreaterIndex(new int[]{2,1,3}),new int[]{2,2,-1}));
        check(Arrays.equals(${nameOf('monotonic-stack')}.nextGreaterIndex(new int[]{2,2}),new int[]{-1,-1}));
        check(Arrays.equals(${nameOf('sliding-window')}.fixedWindowSums(new int[]{2,5,1,4},2),new long[]{7,6,5}));
        check(${nameOf('bitwise')}.countSetBits(-1) == 32);
        check(${nameOf('recursion')}.power(2,5) == 32);
        check(${nameOf('recursion')}.power(3,0) == 1);
        boolean overflow = false;
        try { ${nameOf('recursion')}.power(2,63); } catch (ArithmeticException expected) { overflow = true; }
        check(overflow);
        List<List<Integer>> graph = Arrays.asList(Arrays.asList(1,2),Arrays.asList(3),Arrays.asList(3),new ArrayList<Integer>(),new ArrayList<Integer>());
        check(Arrays.equals(${nameOf('bfs')}.shortestSteps(graph,0),new int[]{0,1,1,2,-1}));
        check(new HashSet<>(${nameOf('dfs')}.depthFirst(graph,0)).equals(new HashSet<>(Arrays.asList(0,1,2,3))));
        List<Integer> order = ${nameOf('topological-sort')}.topologicalOrder(graph);
        for (int u=0;u<graph.size();u++) for(int v:graph.get(u)) check(order.indexOf(u)<order.indexOf(v));
        boolean cycle = false;
        try { ${nameOf('topological-sort')}.topologicalOrder(Arrays.asList(Arrays.asList(1),Arrays.asList(0))); }
        catch (IllegalArgumentException expected) { cycle = true; }
        check(cycle);
        ${nameOf('trie')}.TrieNode root = new ${nameOf('trie')}.TrieNode();
        ${nameOf('trie')}.insertWord(root,"cat"); ${nameOf('trie')}.insertWord(root,"car");
        check(${nameOf('trie')}.containsWord(root,"cat")); check(!${nameOf('trie')}.containsWord(root,"ca"));
        check(Arrays.deepEquals(${nameOf('matrix')}.transpose(new int[][]{{1,2,3},{4,5,6}}),new int[][]{{1,4},{2,5},{3,6}}));
        System.out.println("Algorithm checks passed");
    }
}`;
    const checksFile = path.join(temp, 'AlgorithmChecks.java');
    await fs.writeFile(checksFile, checks);
    const javac = process.argv[2] ?? (process.env.JAVA_HOME
      ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'javac.exe' : 'javac') : 'javac');
    const compile = spawnSync(javac, ['--release', '8', '-encoding', 'UTF-8', '-d', temp, ...files, checksFile], { encoding: 'utf8', windowsHide: true });
    assert.equal(compile.status, 0, compile.error?.message ?? compile.stderr);
    const java = path.isAbsolute(javac) ? path.join(path.dirname(javac), process.platform === 'win32' ? 'java.exe' : 'java') : 'java';
    const run = spawnSync(java, ['-cp', temp, 'AlgorithmChecks'], { encoding: 'utf8', windowsHide: true });
    assert.equal(run.status, 0, run.stderr);
    for (const snippet of snippets.filter((item) => !/^static\s/m.test(item.section.code))) {
      const example = spawnSync(java, ['-cp', temp, snippet.name], { encoding: 'utf8', windowsHide: true });
      assert.equal(example.status, 0, `${snippet.topic.id}/${snippet.section.id}: ${example.stderr}`);
    }
    console.log(JSON.stringify({ topics: catalog.topics.length, mappedProblems: problemIds.length, javaSnippetsCompiled: snippets.length, behavioralChecks: 'passed', examplesExecuted: 'passed' }));
  } finally {
    assert.equal(path.dirname(path.resolve(temp)), path.resolve(os.tmpdir()));
    assert(path.basename(temp).startsWith('hot100-java-'));
    await fs.rm(temp, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
