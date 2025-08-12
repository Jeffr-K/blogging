import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"

const ArticleTitle: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  const title = fileData.frontmatter?.title
  const author = fileData.frontmatter?.author // author 데이터를 가져옵니다.

  if (title) {
    return (
      <div class={classNames(displayClass, "article-title-container")}>
        <h1 class={classNames(displayClass, "article-title")}>{title}</h1>
        {author && <p class="article-author">by {author}</p>} {/* author가 있으면 표시합니다. */}
      </div>
    )
  } else {
    return null
  }
}

ArticleTitle.css = `
.article-title-container {
  margin: 2rem 0 0 0;
}

.article-title {
  margin: 0;
}

.article-author {
  margin: 0.5rem 0 0 0;
  font-style: italic;
  color: var(--darkgray);
}
`

export default (() => ArticleTitle) satisfies QuartzComponentConstructor
