  document.addEventListener('DOMContentLoaded', function () {
    // Create hidden button
    const btn_selectContents = document.getElementById('btn_selectContents')
    const btn_copyContents = document.getElementById('btn_copyContents')

    // Add click handler to button - now selects ALL content in the body
    btn_selectContents.addEventListener('click', function () {
      // Use Selection API to select all content in the body
      console.log('selecting all content in the body')
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(document.body);
      selection.removeAllRanges();
      selection.addRange(range);
    });

    btn_copyContents.addEventListener('click', function () {
      const copyEvent = new ClipboardEvent('copy', {
        bubbles: true,
        cancelable: true
      })
      document.activeElement?.dispatchEvent(copyEvent)
      if (!copyEvent.defaultPrevented) {
        document.execCommand('copy')
      }
    })

    // Add event listener for meta+c
    document.addEventListener('keydown', function (e) {
      if (!(e.metaKey || e.ctrlKey)) return
      e.preventDefault();

      if (e.key === 'c') {
        document.getElementById('btn_copyContents').click();
      } else if (e.key === 'a') {
        document.getElementById('btn_selectContents').click();
      }
    });

    // listen to the clipboard content, and log the html content
    const handleCopy = async () => {
      // Small delay to allow the clipboard to update
      setTimeout(async () => {
        try {
          // Try to read HTML content using paste event
          const clipboardData = await navigator.clipboard.read()
          for (const item of clipboardData) {
            if (item.types.includes('text/html')) {
              const blob = await item.getType('text/html')
              const html = await blob.text()
              console.log('Clipboard HTML content =>', html)
            }
          }
        } catch (error) {
          console.error('Failed to read clipboard =>', error)
        }
      }, 100)
    }
    document.addEventListener('copy', handleCopy)
  });
