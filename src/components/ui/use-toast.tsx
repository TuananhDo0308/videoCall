type ToastProps = {
    title?: string
    description?: string
    variant?: "default" | "destructive"
  }
  
  export function toast(props: ToastProps) {
    if (typeof window !== "undefined") {
      // Create a simple toast notification
      const toastContainer = document.getElementById("toast-container") || createToastContainer()
      const toast = document.createElement("div")
      toast.className = `fixed bottom-4 right-4 p-4 rounded-md shadow-md transition-opacity duration-300 ${
        props.variant === "destructive" ? "bg-red-500 text-white" : "bg-white text-gray-900 border border-gray-200"
      }`
  
      const title = props.title ? `<h4 class="font-medium">${props.title}</h4>` : ""
      const description = props.description ? `<p class="text-sm">${props.description}</p>` : ""
  
      toast.innerHTML = `
        <div class="flex justify-between items-start">
          <div>
            ${title}
            ${description}
          </div>
          <button class="ml-4 text-sm opacity-70 hover:opacity-100" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
      `
  
      toastContainer.appendChild(toast)
  
      // Auto-remove after 5 seconds
      setTimeout(() => {
        if (toast.parentElement) {
          toast.classList.add("opacity-0")
          setTimeout(() => toast.remove(), 300)
        }
      }, 5000)
    }
  }
  
  function createToastContainer() {
    const container = document.createElement("div")
    container.id = "toast-container"
    container.className = "fixed bottom-4 right-4 flex flex-col gap-2 z-50"
    document.body.appendChild(container)
    return container
  }
  