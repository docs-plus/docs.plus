// TODO: need refactor like changeing heading section
export default (arrg, attributes) => {
  const { can, chain, commands, dispatch, editor, state, tr, view } = arrg
  const { schema, selection, doc } = state;
  const { $from, $to, $anchor, $cursor } = selection;
  const { start, end, depth } = $from.blockRange($to);
  const slice = state.doc.slice(start, end);
  let _a;

  const content = ((_a = slice.toJSON()) === null || _a === void 0 ? void 0 : _a.content) || [];
  const commingLevel = attributes.level;

  // select the first paragraph for heading title
  const headingContent = content.length === 1 ? content[0].content[0] : { "type": "text", "text": " " }

  const block = {
    parent: {
      end: $from.end(depth - 1),
      start: $from.start(depth - 1),
    },
    edge: {
      end: $from.end(depth - 1) + 1,
      start: $from.start(depth - 1) - 1,
    },
    ancesster: {
      start: $from.start(1),
      end: $from.end(1)
    },
    end: $from.end(depth),
    start: $from.start(depth),
    nextLevel: 0,
    depth,
    headingContent,
    lineContent: content,
    empty: {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": " "
        }
      ]
    },
    paragraph: { "type": "paragraph", }
  }

  // TODO: check this statment for comment, (block.edge.start !== -1)
  const parentLevel = block.edge.start !== -1 && doc?.nodeAt(block.edge.start)?.content?.content[0]?.attrs.level

  console.log({
    schema,
    block,
    doc,
    beforeLevel: block.edge.start !== -1 && doc?.nodeAt(block.edge.start)?.content?.content[0]?.attrs.level,
    afterLevel: block.edge.start !== -1 && doc?.nodeAt(block.edge.end),
    commingLevel, parentLevel,
    start, end, depth,
    $anchor
  })

  // Create a new heading with the same level
  // in this case all content below must cut and wrapp with the new heading
  // And the depth should be the same as the sibling Heading
  if (commingLevel === parentLevel) {
    console.info("[Heading]: create a new heading with same level")
    const contents = doc.slice(end, block.parent.end)?.content.toJSON()[0].content
    const data = !contents ? [block.paragraph] : contents
    return chain()
      .insertContentAt(block.edge.end, {
        type: 'heading',
        content: [
          {
            type: 'contentHeading',
            content: [block.headingContent],
            attrs: {
              level: attributes.level
            },
          },
          {
            type: 'contentWrapper',
            content: data
          },
        ],
      })
      .setTextSelection(block.edge.end + 2)
      .deleteRange({ from: start + 1, to: block.edge.end })
      .scrollIntoView()
      .run();
  }

  // Create a new Heading block as a child of the current Heading block
  if (commingLevel > parentLevel) {
    console.info("[Heading]: Create a new Heading block as a child of the current Heading block")

    const depthDiff = parentLevel - commingLevel
    let nextLevel = 0

    let closestHeadingPos = 0;
    let closestHeadingLevel = 0;
    let containHeading = false;
    let lastChildHeadingPos = 0
    let firstChildHeadingPos = 0
    let rowr = 0

    // search between the current line till to the end of this block
    doc.nodesBetween(start, block.parent.end, function (node, pos, parent, index) {

      if (node.type.name === "heading" && pos >= start) {
        // console.log("==========>", { ss: (+commingLevel + node.firstChild.attrs.level), commingLevel, type: node.type.name, lvl: node.firstChild.attrs.level })
        // INFO: node.firstChild?.attrs?.level !== parentLevel, do not count the current heading
        if (!containHeading && node.firstChild?.attrs?.level !== parentLevel) containHeading = true;

        if (closestHeadingLevel === 0) {
          closestHeadingPos = pos
          closestHeadingLevel = node.firstChild.attrs.level
        }

        if (node.firstChild?.attrs?.level >= commingLevel) {
          // I don't need the same level just the levels are grather than coming level
          if (node.firstChild?.attrs?.level === commingLevel) return false
          lastChildHeadingPos = pos + node.content.size
          firstChildHeadingPos = pos
          console.log({
            node,
            commingLevel,
            level: node.firstChild?.attrs?.level,
          })
        }

        if (rowr === 0 && node.firstChild.attrs.level >= commingLevel) {
          // console.log("rorororoororoo")
          rowr = pos
        }

        // console.log({ nodeName: node.type.name, pos, level: node.firstChild?.attrs?.level, posRO1: node.type.name === "heading", posRO2: pos >= start, posRO3: commingLevel >= node.firstChild.attrs.level })
        // if coming level is less than next level heading
        if (nextLevel === 0 && commingLevel < node.firstChild.attrs.level) {
          // console.log("yess")
          nextLevel = pos
        }

        if (commingLevel < node.firstChild?.attrs?.level) {
          // console.log("whhhhh", node)
        }

      }
    })

    console.log({
      $anchor,
      commingLevel,
      parentLevel,
      block,
      depthDiff,
      k: attributes.level,
      nextLevel,
      copy: doc.slice(start, lastChildHeadingPos)?.toJSON()?.content,
      containHeading,
      closestHeadingPos,
      lastChildHeadingPos,
      closestHeadingLevel,
    })

    // INFO: !if the current block contain other heading blocks
    if (!containHeading) {
      console.info("[heading]: Current block does not contain heading blocks, Copy the entire content from the start selection option ")
      const contents = doc.slice(end, block.parent.end - 1)?.toJSON()?.content
      const data = !contents ? [block.paragraph] : contents
      console.log("===>", block.headingContent)
      return chain()
        .insertContentAt({ from: start, to: block.parent.end }, {
          type: 'heading',
          content: [
            {
              type: 'contentHeading',
              content: [block.headingContent],
              attrs: {
                level: attributes.level
              },
            },
            {
              type: 'contentWrapper',
              content: data
            },
          ],
        })
        // INFO: this 1 mean skip the toggle button depth
        .setTextSelection(end)
        .scrollIntoView()
        .run()
    }

    if (containHeading && (commingLevel === closestHeadingLevel || commingLevel > closestHeadingLevel)) {
      console.info("[Heading]: the selection block contain Heading block, so find the reletive Headings and copy them into the incoming new Heading")
      const contents = doc.slice(end, closestHeadingPos)?.toJSON()?.content
      const data = !contents?.length ? [block.paragraph] : contents
      console.log({
        contents
      })
      return chain()
        .deleteRange({ from: start, to: closestHeadingPos })
        .insertContentAt(start, {
          type: 'heading',
          content: [
            {
              type: 'contentHeading',
              content: [block.headingContent],
              attrs: {
                level: attributes.level
              },
            },
            {
              type: 'contentWrapper',
              content: data
            },
          ],
        })
        // INFO: this 1 mean skip the toggle button and move to the next depth
        .setTextSelection(start + 1)
        .scrollIntoView()
        .run()
    }

    // if coming level is grather than parent level and the coming level is less than closing level
    // copy entire data to the end and put them to comming level
    if (containHeading && commingLevel < closestHeadingLevel) {
      console.info("[Heading]: Current Block contain heading blocks, wrapp up the content from start to closestHeading level")
      const dataContent = doc.slice(start, lastChildHeadingPos)?.content.toJSON()
      const data = !dataContent ? [block.paragraph] : dataContent
      return chain()
        .insertContentAt({ from: start, to: lastChildHeadingPos }, {
          type: 'heading',
          content: [
            {
              type: 'contentHeading',
              content: [block.headingContent],
              attrs: {
                level: attributes.level
              },
            },
            {
              type: 'contentWrapper',
              content: data
            },
          ],
        })
        // Info: 1 mean skip the toggle button block
        .setTextSelection(start + 1)
        .run();
    }

    // TODO: check if this happening or not
    console.log("not simple")

    //TODO: the problame is find the last position of the heading for copy
    return chain()
      .insertContentAt(block.edge.end, {
        type: 'heading',
        content: [
          {
            type: 'contentHeading',
            content: [block.headingContent],
            attrs: {
              level: attributes.level
            },
          },
          {
            type: 'contentWrapper',
            content: doc.cut(start).nodeAt(depth - 1).content.toJSON()
          },
        ],
      })
      // .insertContentAt(block.edge.end + 6, doc.slice($anchor.pos, block.parent.end).toJSON().content)
      .setTextSelection(block.edge.end + 2)
      .insertContentAt($from.pos, "<p></p>")
      .deleteRange({ from: start + 1, to: block.edge.end })
      .run();

  }

  // break chain of heading blocs
  if (commingLevel < parentLevel) {
    console.info("[Heading]: break the current Heading chain, cominglevel is grether than parentLevel")

    let insertAt = 0
    switch (commingLevel) {
      case 1:
        insertAt = 0
        break;
      case 2:
        insertAt = 3
        break;
      case 3:
        insertAt = 5
        break;
      case 4:
        insertAt = 7
        break;
      case 5:
        insertAt = 9
        break;
      case 6:
        insertAt = 11
        break;

      default:
        break;
    }


    console.log("the hard path")

    const titleNode = $from.doc.nodeAt($from.start(1) - 1)
    const titleStartPos = $from.start(1) - 1
    const titleEndPos = titleStartPos + titleNode.content.size


    const currentAncessterPosStart = $from.start(1) - 1
    const currentAncessterPosEnd = titleStartPos + titleNode.content.size
    let currentDepthHeadings = []

    doc.nodesBetween(currentAncessterPosStart, currentAncessterPosEnd, function (node, pos, parent, index) {
      if (node.type.name === "heading") {
        if (currentDepthHeadings[currentDepthHeadings.length - 1]?.le > node.firstChild?.attrs?.level) {
          console.log("yeo yeo", {
            pos,
            le: node.firstChild?.attrs?.level,
          })
          currentDepthHeadings.shift()
        }
        currentDepthHeadings.push({
          pos,
          le: node.firstChild?.attrs?.level,
        })
      }
    })

    // remove the H1
    currentDepthHeadings.shift()
    console.log(currentDepthHeadings)
    const targetHeadingPos = currentDepthHeadings.find(x => commingLevel <= x.le).pos
    // INFO: this 1 mean move to the contentWrapper
    insertAt = $from.sharedDepth(targetHeadingPos) + 1
    if (commingLevel === 1) insertAt = 0

    const data = []
    let firstHEading = true
    let flagOne = true
    let prevLevel = 0


    doc.nodesBetween(end, $from.end(insertAt), function (node, pos, parent, index) {

      if (pos < start) return

      if (firstHEading && node.type.name === "paragraph") {
        data.push(node.toJSON())
      }

      if (node.type.name === "heading") {
        firstHEading = false
        const headingLevel = node.firstChild?.attrs?.level
        if (prevLevel === 0)
          prevLevel = headingLevel

        if (flagOne && prevLevel >= headingLevel) {
          data.push({ ...node.toJSON(), le: headingLevel })
        }

        prevLevel = headingLevel
      }

    })

    return chain()
      .insertContentAt($from.end(insertAt), {
        type: 'heading',
        content: [
          {
            type: 'contentHeading',
            content: [block.headingContent],
            attrs: {
              level: attributes.level
            },
          },
          {
            type: 'contentWrapper',
            content: data.length === 0 ? [block.paragraph] : data
          },
        ],
      })
      .insertContentAt(end, block.paragraph, { updateSelection: false })
      .setTextSelection($from.end(insertAt) + 1)
      .deleteRange({
        from: start + 1, to: $from.end(insertAt)
      })
      .scrollIntoView()
      .run()
    // }

  }
}
