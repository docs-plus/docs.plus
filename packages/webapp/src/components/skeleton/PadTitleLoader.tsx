type Props = {}
export const PadTitleLoader = ({}: Props) => {
  return (
    <div className="docTitle relative z-10 flex min-h-12 w-full flex-row items-center bg-white p-2 py-4 shadow-md md:shadow-none">
      <div className="skeleton hidden h-10 w-10 md:block"></div>
      <div className="skeleton ml-4 h-5 w-32"></div>
      <div className="skeleton ml-auto mr-4 hidden h-8 w-20 md:block"></div>
      <div className="skeleton ml-auto h-10 w-10 rounded-full md:ml-0"></div>
    </div>
  )
}
