Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

function New-Paragraph($xml, $ns, $style, $text) {
  $paragraph = $xml.CreateElement('w:p', $ns.LookupNamespace('w'))
  $properties = $xml.CreateElement('w:pPr', $ns.LookupNamespace('w'))
  $styleNode = $xml.CreateElement('w:pStyle', $ns.LookupNamespace('w'))
  $styleNode.SetAttribute('val', $ns.LookupNamespace('w'), $style)
  [void]$properties.AppendChild($styleNode)
  [void]$paragraph.AppendChild($properties)
  $run = $xml.CreateElement('w:r', $ns.LookupNamespace('w'))
  $textNode = $xml.CreateElement('w:t', $ns.LookupNamespace('w'))
  $textNode.InnerText = $text
  [void]$run.AppendChild($textNode)
  [void]$paragraph.AppendChild($run)
  return $paragraph
}

function Update-Docx($path) {
  $temporaryPath = "$path.hardware-updated"
  $inputZip = [IO.Compression.ZipFile]::OpenRead($path)
  $outputZip = [IO.Compression.ZipFile]::Open($temporaryPath, [IO.Compression.ZipArchiveMode]::Create)
  try {
    foreach ($entry in $inputZip.Entries) {
      $outputEntry = $outputZip.CreateEntry($entry.FullName, [IO.Compression.CompressionLevel]::Optimal)
      $outputStream = $outputEntry.Open()
      try {
        if ($entry.FullName -ne 'word/document.xml') {
          $inputStream = $entry.Open()
          try { $inputStream.CopyTo($outputStream) } finally { $inputStream.Dispose() }
        } else {
          $reader = [IO.StreamReader]::new($entry.Open())
          try { $xml = [Xml.XmlDocument]$reader.ReadToEnd() } finally { $reader.Dispose() }
          $ns = New-Object Xml.XmlNamespaceManager($xml.NameTable)
          $ns.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
          $anchor = $xml.SelectNodes('//w:body/w:p', $ns) | Where-Object {
            (($_.SelectNodes('.//w:t', $ns) | ForEach-Object { $_.'#text' }) -join '') -eq '2. Technical Background'
          } | Select-Object -First 1
          if ($anchor) {
            $hardwareHeading = New-Paragraph $xml $ns 'Heading2' 'Hardware Requirements'
            $hardwareText = New-Paragraph $xml $ns 'Normal' 'The system requires a computer or laptop with a modern web browser, keyboard, mouse, display, and reliable internet or local network access. A USB QR scanner that acts as keyboard input is required for rapid scanning. A printer is optional for printing student ID cards or reports. No biometric device or dedicated attendance server is required at the client workstation.'
            $softwareHeading = New-Paragraph $xml $ns 'Heading2' 'Software Requirements'
            $softwareText = New-Paragraph $xml $ns 'The development environment uses Node.js, npm or pnpm, React 19, Vite 8, Tailwind CSS 4, and an Express API service. Production use requires a supported browser, Firebase Authentication, Firebase Firestore, and configured server environment variables for QR signing and SMS delivery. Cloudinary is optional for student photos; Twilio or Semaphore is optional for live SMS delivery.'
            [void]$anchor.ParentNode.InsertAfter($softwareText, $anchor)
            [void]$anchor.ParentNode.InsertBefore($softwareHeading, $softwareText)
            [void]$anchor.ParentNode.InsertBefore($hardwareText, $softwareHeading)
            [void]$anchor.ParentNode.InsertBefore($hardwareHeading, $hardwareText)
          }
          $settings = New-Object Xml.XmlWriterSettings
          $settings.Encoding = New-Object Text.UTF8Encoding($false)
          $writer = [Xml.XmlWriter]::Create($outputStream, $settings)
          try { $xml.Save($writer) } finally { $writer.Dispose() }
        }
      } finally { $outputStream.Dispose() }
    }
  } finally {
    $inputZip.Dispose()
    $outputZip.Dispose()
  }
  Move-Item -LiteralPath $temporaryPath -Destination $path -Force
}

Update-Docx 'src\imports\G9-LNHS-Attendance-Monitoring.docx'
Update-Docx '..\G9-LNHS-Attendance-Monitoring.docx'