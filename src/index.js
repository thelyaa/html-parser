import jsdom from 'jsdom'

export enum EFormattingStyle {
  Bold = 'b',
  Italic = 'i',
  Underline = 'u',
  Centerline = 's',
  Link = 'a'
}

export const getTextNode = (node: Node): Node => {
  if (node.hasChildNodes()) {
    return getTextNode(node.childNodes[0])
  }

  return node
}

export const isNodeFormatted = (nodeName: string): boolean => {
  return Object.values(EFormattingStyle).includes(
    nodeName.toLowerCase() as EFormattingStyle
  )
}

export const findNodeHref = (node: Node): string | undefined => {
  if (node.nodeName === 'A') {
    return (node as HTMLLinkElement).href
  } else if (node.hasChildNodes()) {
    for (let i = 0; i < node.childNodes.length; i++) {
      return findNodeHref(node.childNodes[i])
    }
  }
}

const wrapRowsInDiv = (htmlStr: string): string => {
  const rows = [...htmlStr.matchAll(/(\r\n|\r|\n|<br>|<br \/>|<br\/>)/g)]
  if (rows) {
    let newStr = ''
    for (let i = 0; i < rows.length; i++) {
      const rowIndex = rows[i].index
      if (rowIndex === undefined) continue

      if (!newStr) {
        newStr += '<div>' + [...htmlStr].slice(0, rowIndex).join('') + '</div>'
      }

      newStr +=
        '<div>' +
        [...htmlStr]
          .slice(rowIndex + rows[i][0]?.length, rows[i + 1]?.index)
          .join('') +
        '</div>'
    }

    return newStr
  }

  return htmlStr
}

const checkNodeFormatting = (
  node: Node,
  rowIndex: number
): string[] => {
  if (!node.childNodes?.length) return ['']

  let noTagRowText = ''
  let textPosition = 0
  const rowFormatting: string[] = []

  for (let i = 0; i < node.childNodes.length; i++) {
    const childNode = node.childNodes[i]
    const childNodeName = childNode.nodeName.toLowerCase()

    if (!isNodeFormatted(childNodeName)) {
      textPosition += [...childNode.textContent || ''].length
      noTagRowText += childNode.textContent || ''
      continue
    }

    const nodeClone = childNode.cloneNode(true)
    const textNode = getTextNode(nodeClone)
    noTagRowText += textNode.textContent || ''

    if (textNode.parentElement) {
      textNode.parentElement.removeChild(textNode)

      const nodeHtmlClone = (nodeClone as Element).outerHTML
      const textFormattingStyles = nodeHtmlClone.match(/<[bius]|[a]>/gi)

      if (textFormattingStyles) {
        let formattingStyles = ''
        textFormattingStyles.forEach(format => {
          const formatName = format.replace(/[<>]/g, '')

          formattingStyles += formatName
        })

        const endPosition = textPosition + [...textNode.textContent || ''].length

        // additional param like link's href
        const additionalParam = formattingStyles.includes('a')
          ? findNodeHref(childNode)
          : ''

        rowFormatting.push(
          `[${rowIndex}, ${textPosition}, ${endPosition}, ${formattingStyles}, ${additionalParam}]`
        )

        textPosition = endPosition
      }
    }
  }

  const nodeName = node.nodeName.toLowerCase()

  if (!rowFormatting.length && isNodeFormatted(nodeName)) {
    const nodeText = node.textContent || ''
    rowFormatting.push(`[${rowIndex}, 0, ${nodeText.length}, ${nodeName}]`)
    noTagRowText += nodeText
  }

  return [rowFormatting.join(''), noTagRowText]
}

export const parseTextFormatting = (str: string): string[] => {
  const { JSDOM } = jsdom
  const { document } = new JSDOM().window

  const inputElement = document.createElement('div')
  inputElement.innerHTML = wrapRowsInDiv(str)

  if (!inputElement.childNodes?.length) return [str]

  const formattingPosition: string[] = []
  let rowIndex = 0
  let noTagText = ''

  for (let i = 0; i < inputElement.childNodes.length; i++) { // for по строкам
    const result = checkNodeFormatting(inputElement.childNodes[i], rowIndex)

    formattingPosition.push(result[0])

    noTagText += result[1] + (inputElement.childNodes[i + 1] ? '\n' : '')
    rowIndex++
  }

  return [formattingPosition.join(''), noTagText]
}
