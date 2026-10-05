import type { Lang } from './analyzer';

export interface Example {
  label: string;
  lang: Lang;
  code: string;
}

export const EXAMPLES: Example[] = [
  {
    label: 'Intern’s first PR',
    lang: 'javascript',
    code: `var apiKey = "sk-live-9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c";

function getData(x) {
  var data = [];
  for (var i = 0; i < x.length; i++) {
    if (x[i] != null) {
      if (x[i].active == true) {
        if (x[i].age > 18) {
          if (x[i].country == "US") {
            data.push(x[i]);
            console.log("pushed", x[i]);
          }
        }
      }
    }
  }
  // return data.filter(d => d.active);
  return data;
}

try {
  eval("getData(window.users)");
} catch (e) {}

// TODO: fix this later
// TODO: actually fix this later
debugger;
`,
  },
  {
    label: 'TypeScript in name only',
    lang: 'typescript',
    code: `// @ts-nocheck
export async function handler(req: any, res: any) {
  const temp: any = req.body as any;
  const status = temp.ok ? temp.retry ? "retrying" : "ok" : temp.fatal ? "dead" : "meh";
  // eslint-disable-next-line
  const result = await fetch("https://example.com/api?user=" + temp.user + "&token=" + temp.token + "&debug=true&verbose=true&x=1");
  const json: any = await result.json();
  console.log(json);
  console.log(json);
  return res.send({ status, json });
}
`,
  },
  {
    label: 'Python script from 2011',
    lang: 'python',
    code: `from os import *
from utils import *

password = "hunter2hunter2"
cache = None

def load(items=[], opts={}):
    global cache
    for i in items:
        if i:
            if i.get("x"):
                if i["x"] > 0:
                    if i["x"] < 100:
                        items.append(i)
                        print("added", i)
    try:
        cache = open("data.json").read()
    except:
        pass
    # return items
    return items
`,
  },
];
