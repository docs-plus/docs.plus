import React, { useState, useContext, createContext, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import styles from './Tabs.module.css'

// Create a Context to allow child components to consume tab related states and functions.
const TabsContext = createContext()

// The Tabs component acts as the container for all tab-related components.
function Tabs({ children, defaultActiveTab = null, putNameAsHashToURI = true, ...props }) {
  // Initialize the active tab state with defaultActiveTab
  const [activeTab, setActiveTab] = useState(defaultActiveTab)
  const router = useRouter()

  // Function to change the active tab
  const changeTab = (tabName) => {
    setActiveTab(tabName)
    if (putNameAsHashToURI) router.replace(`#panel=${tabName}`)
  }

  const value = {
    activeTab,
    setActiveTab,
    defaultActiveTab,
    putNameAsHashToURI,
    changeTab
  }

  // Provide tab states and setter function to child components.
  return (
    <TabsContext.Provider value={value}>
      <div className={`w-full ${styles.tabs}`} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

// TabList manages the list of tab buttons.
function TabList({ children, ...props }) {
  const tabsElement = useRef(null)
  const [highlightStyle, setHighlightStyle] = useState({})
  const router = useRouter()
  const { activeTab, setActiveTab, defaultActiveTab, putNameAsHashToURI } = useContext(TabsContext)

  // On component mount and update, update the active tab based on the URL hash.
  useEffect(() => {
    if (!putNameAsHashToURI) return setActiveTab(defaultActiveTab)
    // Get the panel name from the URL hash.
    const panel = new URLSearchParams(window.location.hash.replace('#', '')).get('panel')

    if (!panel) return setActiveTab(defaultActiveTab)

    // Collect all the panel names from the children (tab buttons).
    const panelNames = React.Children.toArray(children).map((child) => child.props.name)

    // If the panel name exists in the child panel names, update the active tab.
    if (panelNames.includes(panel)) {
      setActiveTab(panel)
    } else {
      setActiveTab(defaultActiveTab)
    }
  }, [router.asPath, children])

  // This function updates the highlight style for the active tab button.
  const updateHighlight = useCallback(() => {
    const tabsNode = tabsElement.current
    const activeTabNode = tabsNode.querySelector(`[data-active='true']`)
    if (activeTabNode) {
      const rect = activeTabNode.getBoundingClientRect()
      const containerRect = tabsNode.getBoundingClientRect()

      setHighlightStyle({
        left: `${rect.left - containerRect.left}px`,
        width: `${rect.width}px`
      })
    }
  }, [activeTab])

  // This effect is responsible for updating the highlight and cleaning up event listeners.
  useEffect(() => {
    updateHighlight()

    window.addEventListener('resize', updateHighlight)

    const tabsNode = tabsElement.current
    const resizeObserver = new ResizeObserver(updateHighlight)

    if (tabsNode) {
      resizeObserver.observe(tabsNode)
    }

    return () => {
      window.removeEventListener('resize', updateHighlight)

      if (tabsNode) {
        resizeObserver.unobserve(tabsNode)
      }
    }
  }, [tabsElement, updateHighlight])

  return (
    <nav
      ref={tabsElement}
      className={`relative flex border-b border-gray-200 ${styles.tabList}`}
      {...props}>
      <div
        className={`absolute bottom-1 rounded-md bg-docsy h-1 transition-all duration-300 ${styles.highlight}`}
        style={highlightStyle}
      />
      {children}
    </nav>
  )
}

// The Tab component represents an individual tab button.
function Tab({ children, name, ...props }) {
  const router = useRouter()
  const { activeTab, setActiveTab, putNameAsHashToURI } = useContext(TabsContext)
  const isActive = activeTab === name

  const onClick = () => {
    setActiveTab(name)
    if (putNameAsHashToURI) router.replace(`#panel=${name}`)
  }

  const defaultClassName = `p-4 px-6 hover:text-indigo-700 focus:outline-none ${
    isActive ? 'text-docsy' : 'text-gray-500'
  }`

  // Append defaultClassName to existing className or assign it if not present.
  props.className = props.className ? `${props.className} ${defaultClassName}` : defaultClassName

  return (
    <button data-active={isActive} id={`btnTab_${name}`} onClick={onClick} name={name} {...props}>
      {children}
    </button>
  )
}

// The TabPanels component serves as a container for TabPanel components.
function TabPanels({ children, ...props }) {
  const { activeTab } = useContext(TabsContext)

  // Filter children based on activeTab name
  const activeChild = React.Children.toArray(children).find(
    (child) => child.props.name === activeTab
  )

  return (
    <div className={`p-4 ${styles.tabPanels}`} {...props}>
      {activeChild}
    </div>
  )
}

// The TabPanel component represents the content of a tab.
function TabPanel({ children, name, ...props }) {
  return (
    <div name={name} {...props}>
      {children}
    </div>
  )
}

export { Tabs, TabList, Tab, TabPanels, TabPanel, TabsContext }
