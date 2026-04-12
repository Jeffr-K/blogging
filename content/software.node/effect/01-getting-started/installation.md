Installation
Requirements:

TypeScript 5.4 or newer.
Node.js, Deno, and Bun are supported.
Manual Installation
Node.js
Follow these steps to create a new Effect project for Node.js:

Create a project directory and navigate into it:

Terminal window
mkdir hello-effect
cd hello-effect

Initialize a TypeScript project:

npm
pnpm
Yarn
Terminal window
npm init -y
npm install --save-dev typescript

This creates a package.json file with an initial setup for your TypeScript project.

Initialize TypeScript:

npm
pnpm
Yarn
Terminal window
npx tsc --init

When running this command, it will generate a tsconfig.json file that contains configuration options for TypeScript. One of the most important options to consider is the strict flag.

Make sure to open the tsconfig.json file and verify that the value of the strict option is set to true.

{
  "compilerOptions": {
    "strict": true
  }
}

Install the necessary package as dependency:

npm
pnpm
Yarn
Terminal window
npm install effect

This package will provide the foundational functionality for your Effect project.

Let’s write and run a simple program to ensure that everything is set up correctly.

In your terminal, execute the following commands:

Terminal window
mkdir src
touch src/index.ts

Open the index.ts file and add the following code:

src/index.ts
import { Effect, Console } from "effect"

const program = Console.log("Hello, World!")

Effect.runSync(program)

Run the index.ts file. Here we are using tsx to run the index.ts file in the terminal:

Terminal window
npx tsx src/index.ts

You should see the message "Hello, World!" printed. This confirms that the program is working correctly.

Deno
Follow these steps to create a new Effect project for Deno:

Create a project directory and navigate into it:

Terminal window
mkdir hello-effect
cd hello-effect

Initialize Deno:

Terminal window
deno init

Install the necessary package as dependency:

Terminal window
deno add npm:effect

This package will provide the foundational functionality for your Effect project.

Let’s write and run a simple program to ensure that everything is set up correctly.

Open the main.ts file and replace the content with the following code:

main.ts
import { Effect, Console } from "effect"

const program = Console.log("Hello, World!")

Effect.runSync(program)

Run the main.ts file:

Terminal window
deno run main.ts

You should see the message "Hello, World!" printed. This confirms that the program is working correctly.

Bun
Follow these steps to create a new Effect project for Bun:

Create a project directory and navigate into it:

Terminal window
mkdir hello-effect
cd hello-effect

Initialize Bun:

Terminal window
bun init

When running this command, it will generate a tsconfig.json file that contains configuration options for TypeScript. One of the most important options to consider is the strict flag.

Make sure to open the tsconfig.json file and verify that the value of the strict option is set to true.

{
  "compilerOptions": {
    "strict": true
  }
}

Install the necessary package as dependency:

Terminal window
bun add effect

This package will provide the foundational functionality for your Effect project.

Let’s write and run a simple program to ensure that everything is set up correctly.

Open the index.ts file and replace the content with the following code:

index.ts
import { Effect, Console } from "effect"

const program = Console.log("Hello, World!")

Effect.runSync(program)

Run the index.ts file:

Terminal window
bun index.ts

You should see the message "Hello, World!" printed. This confirms that the program is working correctly.

Vite + React
Follow these steps to create a new Effect project for Vite + React:

Scaffold your Vite project, open your terminal and run the following command:

npm
pnpm
Yarn
Bun
Deno
Terminal window
# npm 6.x
npm create vite@latest hello-effect --template react-ts
# npm 7+, extra double-dash is needed
npm create vite@latest hello-effect -- --template react-ts

This command will create a new Vite project with React and TypeScript template.

Navigate into the newly created project directory and install the required packages:

npm
pnpm
Yarn
Bun
Deno
Terminal window
cd hello-effect
npm install

Once the packages are installed, open the tsconfig.json file and ensure that the value of the strict option is set to true.

{
  "compilerOptions": {
    "strict": true
  }
}

Install the necessary package as dependency:

npm
pnpm
Yarn
Bun
Deno
Terminal window
npm install effect

This package will provide the foundational functionality for your Effect project.

Now, let’s write and run a simple program to ensure that everything is set up correctly.

Open the src/App.tsx file and replace its content with the following code:

src/App.tsx
import { useState, useMemo, useCallback } from "react"
import reactLogo from "./assets/react.svg"
import viteLogo from "/vite.svg"
import "./App.css"
import { Effect } from "effect"

function App() {
  const [count, setCount] = useState(0)

  const task = useMemo(
    () => Effect.sync(() => setCount((current) => current + 1)),
    [setCount]
  )

  const increment = useCallback(() => Effect.runSync(task), [task])

  return (
    <>
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={increment}>count is {count}</button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App

After making these changes, start the development server by running the following command:

npm
pnpm
Yarn
Bun
Deno
Terminal window
npm run dev

Then, press o to open the application in your browser.

When you click the button, you should see the counter increment. This confirms that the program is working correctly.
