Effect vs neverthrow
When working with error handling in TypeScript, both neverthrow and Effect provide useful abstractions for modeling success and failure without exceptions. They share many concepts, such as wrapping computations in a safe container, transforming values with map, handling errors with mapErr/mapLeft, and offering utilities to combine or unwrap results.

This page shows a side-by-side comparison of neverthrow and Effect APIs for common use cases. If you’re already familiar with neverthrow, the examples will help you understand how to achieve the same patterns with Effect. If you’re starting fresh, the comparison highlights the similarities and differences so you can decide which library better fits your project.

neverthrow exposes instance methods (for example, result.map(...)). Effect exposes functions on Either (for example, Either.map(result, ...)) and supports a pipe style for readability and better tree shaking.

Synchronous API
ok
Example (Creating a success result)

neverthrow
Effect
import { ok } from "neverthrow"

const result = ok({ myData: "test" })

result.isOk() // true
result.isErr() // false


err
Example (Creating a failure result)

neverthrow
Effect
import { err } from "neverthrow"

const result = err("Oh no")

result.isOk() // false
result.isErr() // true


map
Example (Transforming the success value)

neverthrow
Effect
import { Result } from "neverthrow"

declare function getLines(s: string): Result<Array<string>, Error>

const result = getLines("1\n2\n3\n4\n")

// this Result now has a Array<number> inside it
const newResult = result.map((arr) => arr.map(parseInt))

newResult.isOk() // true


mapErr
Example (Transforming the error value)

neverthrow
Effect
import { Result } from "neverthrow"

declare function parseHeaders(
  raw: string
): Result<Record<string, string>, string>

const rawHeaders = "nonsensical gibberish and badly formatted stuff"

const result = parseHeaders(rawHeaders)

// const newResult: Result<Record<string, string>, Error>
const newResult = result.mapErr((err) => new Error(err))


unwrapOr
Example (Providing a default value)

neverthrow
Effect
import { err } from "neverthrow"

const result = err("Oh no")

const multiply = (value: number): number => value * 2

const unwrapped = result.map(multiply).unwrapOr(10)


andThen
Example (Chaining computations that may fail)

neverthrow
Effect
import { ok, Result, err } from "neverthrow"

const sqrt = (n: number): Result<number, string> =>
  n > 0 ? ok(Math.sqrt(n)) : err("n must be positive")

ok(16).andThen(sqrt).andThen(sqrt)
// Ok(2)


asyncAndThen
Example (Chaining asynchronous computations that may fail)

neverthrow
Effect
import { ok, okAsync } from "neverthrow"

// const result: ResultAsync<number, never>
const result = ok(1).asyncAndThen((n) => okAsync(n + 1))


orElse
Example (Providing an alternative on failure)

neverthrow
Effect
import { Result, err, ok } from "neverthrow"

enum DatabaseError {
  PoolExhausted = "PoolExhausted",
  NotFound = "NotFound"
}

const dbQueryResult: Result<string, DatabaseError> = err(
  DatabaseError.NotFound
)

const updatedQueryResult = dbQueryResult.orElse((dbError) =>
  dbError === DatabaseError.NotFound
    ? ok("User does not exist")
    : err(500)
)


match
Example (Pattern matching on success or failure)

neverthrow
Effect
import { Result } from "neverthrow"

declare const myResult: Result<number, string>

myResult.match(
  (value) => `The value is ${value}`,
  (error) => `The error is ${error}`
)


asyncMap
Example (Parsing headers and looking up a user)

neverthrow
Effect
import { Result } from "neverthrow"

interface User {}
declare function parseHeaders(
  raw: string
): Result<Record<string, string>, string>
declare function findUserInDatabase(
  authorization: string
): Promise<User | undefined>

const rawHeader = "Authorization: Bearer 1234567890"

// const asyncResult: ResultAsync<User | undefined, string>
const asyncResult = parseHeaders(rawHeader)
  .map((kvMap) => kvMap["Authorization"])
  .asyncMap((authorization) =>
    authorization === undefined
      ? Promise.resolve(undefined)
      : findUserInDatabase(authorization)
  )


combine
Example (Combining multiple results)

neverthrow
Effect
import { Result, ok } from "neverthrow"

const results: Result<number, string>[] = [ok(1), ok(2)]

// const combined: Result<number[], string>
const combined = Result.combine(results)


combineWithAllErrors
Example (Collecting all errors and successes)

neverthrow
Effect
import { Result, ok, err } from "neverthrow"

const results: Result<number, string>[] = [
  ok(123),
  err("boooom!"),
  ok(456),
  err("ahhhhh!")
]

const result = Result.combineWithAllErrors(results)
// result is Err(['boooom!', 'ahhhhh!'])


Note. There is no exact equivalent of Result.combineWithAllErrors in Effect. Use Array.getLefts to collect all errors and Array.getRights to collect all successes.

Asynchronous API
In the examples below we use Effect.runPromise to run an effect and return a Promise. You can also use other APIs such as Effect.runPromiseExit, which can capture additional cases like defects (runtime errors) and interruptions.

okAsync
Example (Creating a successful async result)

neverthrow
Effect
import { okAsync } from "neverthrow"

const myResultAsync = okAsync({ myData: "test" })

const result = await myResultAsync

result.isOk() // true
result.isErr() // false


errAsync
Example (Creating a failed async result)

neverthrow
Effect
import { errAsync } from "neverthrow"

const myResultAsync = errAsync("Oh no")

const myResult = await myResultAsync

myResult.isOk() // false
myResult.isErr() // true


fromThrowable
Example (Wrapping a Promise-returning function that may throw)

neverthrow
Effect
import { ResultAsync } from "neverthrow"

interface User {}
declare function insertIntoDb(user: User): Promise<User>

// (user: User) => ResultAsync<User, Error>
const insertUser = ResultAsync.fromThrowable(
  insertIntoDb,
  () => new Error("Database error")
)


map
Example (Transforming the success value)

neverthrow
Effect
import { Result, ResultAsync } from "neverthrow"

interface User {
  readonly name: string
}
declare function findUsersIn(
  country: string
): ResultAsync<Array<User>, Error>

const usersInCanada = findUsersIn("Canada")

const namesInCanada = usersInCanada.map((users: Array<User>) =>
  users.map((user) => user.name)
)

// We can extract the Result using .then() or await
namesInCanada.then((namesResult: Result<Array<string>, Error>) => {
  if (namesResult.isErr()) {
    console.log(
      "Couldn't get the users from the database",
      namesResult.error
    )
  } else {
    console.log(
      "Users in Canada are named: " + namesResult.value.join(",")
    )
  }
})


mapErr
Example (Transforming the error value)

neverthrow
Effect
import { Result, ResultAsync } from "neverthrow"

interface User {
  readonly name: string
}
declare function findUsersIn(
  country: string
): ResultAsync<Array<User>, Error>

const usersInCanada = findUsersIn("Canada").mapErr((error: Error) => {
  // The only error we want to pass to the user is "Unknown country"
  if (error.message === "Unknown country") {
    return error.message
  }
  // All other errors will be labelled as a system error
  return "System error, please contact an administrator."
})

usersInCanada.then((usersResult: Result<Array<User>, string>) => {
  if (usersResult.isErr()) {
    console.log(
      "Couldn't get the users from the database",
      usersResult.error
    )
  } else {
    console.log("Users in Canada are: " + usersResult.value.join(","))
  }
})


unwrapOr
Example (Providing a default value when async fails)

neverthrow
Effect
import { errAsync } from "neverthrow"

const unwrapped = await errAsync(0).unwrapOr(10)
// unwrapped = 10


andThen
Example (Chaining multiple async computations)

neverthrow
Effect
import { Result, ResultAsync } from "neverthrow"

interface User {}
declare function validateUser(user: User): ResultAsync<User, Error>
declare function insertUser(user: User): ResultAsync<User, Error>
declare function sendNotification(user: User): ResultAsync<void, Error>

const user: User = {}

const resAsync = validateUser(user)
  .andThen(insertUser)
  .andThen(sendNotification)

resAsync.then((res: Result<void, Error>) => {
  if (res.isErr()) {
    console.log("Oops, at least one step failed", res.error)
  } else {
    console.log(
      "User has been validated, inserted and notified successfully."
    )
  }
})


orElse
Example (Fallback when an async operation fails)

neverthrow
Effect
import { ResultAsync, ok } from "neverthrow"

interface User {}
declare function fetchUserData(id: string): ResultAsync<User, Error>
declare function getDefaultUser(): User

const userId = "123"

// Try to fetch user data, but provide a default if it fails
const userResult = fetchUserData(userId).orElse(() =>
  ok(getDefaultUser())
)

userResult.then((result) => {
  if (result.isOk()) {
    console.log("User data:", result.value)
  }
})


match
Example (Handling success and failure at the end of a chain)

neverthrow
Effect
import { ResultAsync } from "neverthrow"

interface User {
  readonly name: string
}
declare function validateUser(user: User): ResultAsync<User, Error>
declare function insertUser(user: User): ResultAsync<User, Error>

const user: User = { name: "John" }

// Handle both cases at the end of the chain using match
const resultMessage = await validateUser(user)
  .andThen(insertUser)
  .match(
    (user: User) => `User ${user.name} has been successfully created`,
    (error: Error) => `User could not be created because ${error.message}`
  )


combine
Example (Combining multiple async results)

neverthrow
Effect
import { ResultAsync, okAsync } from "neverthrow"

const resultList: ResultAsync<number, string>[] = [okAsync(1), okAsync(2)]

// const combinedList: ResultAsync<number[], string>
const combinedList = ResultAsync.combine(resultList)


combineWithAllErrors
Example (Collecting all errors instead of failing fast)

neverthrow
Effect
import { ResultAsync, okAsync, errAsync } from "neverthrow"

const resultList: ResultAsync<number, string>[] = [
  okAsync(123),
  errAsync("boooom!"),
  okAsync(456),
  errAsync("ahhhhh!")
]

const result = await ResultAsync.combineWithAllErrors(resultList)
// result is Err(['boooom!', 'ahhhhh!'])


Utilities
fromThrowable
Example (Safely wrapping a throwing function)

neverthrow
Effect
import { Result } from "neverthrow"

type ParseError = { message: string }
const toParseError = (): ParseError => ({ message: "Parse Error" })

const safeJsonParse = Result.fromThrowable(JSON.parse, toParseError)

// the function can now be used safely,
// if the function throws, the result will be an Err
const result = safeJsonParse("{")


safeTry
Example (Using generators to simplify error handling)

neverthrow
Effect
import { Result, ok, safeTry } from "neverthrow"

declare function mayFail1(): Result<number, string>
declare function mayFail2(): Result<number, string>

function myFunc(): Result<number, string> {
  return safeTry<number, string>(function* () {
    return ok(
      (yield* mayFail1().mapErr(
        (e) => `aborted by an error from 1st function, ${e}`
      )) +
        (yield* mayFail2().mapErr(
          (e) => `aborted by an error from 2nd function, ${e}`
        ))
    )
  })
}


Note. With Either.gen, you do not need to wrap the final value with Either.right. The generator’s return value becomes the Right.

You can also use an async generator function with safeTry to represent an asynchronous block. On the Effect side, the same pattern is written with Effect.gen instead of Either.gen.

Example (Using async generators to handle multiple failures)

neverthrow
Effect
import { ResultAsync, safeTry, ok } from "neverthrow"

declare function mayFail1(): ResultAsync<number, string>
declare function mayFail2(): ResultAsync<number, string>

function myFunc(): ResultAsync<number, string> {
  return safeTry<number, string>(async function* () {
    return ok(
      (yield* mayFail1().mapErr(
        (e) => `aborted by an error from 1st function, ${e}`
      )) +
        (yield* mayFail2().mapErr(
          (e) => `aborted by an error from 2nd function, ${e}`
        ))
    )
  })
}


Note. With Effect.gen, you do not need to wrap the final value with Effect.succeed. The generator’s return value becomes the Success.
