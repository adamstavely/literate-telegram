{{/*
Expand the name of the chart.
*/}}
{{- define "interop.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
*/}}
{{- define "interop.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart label value (chart name + version).
*/}}
{{- define "interop.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels applied to every resource.
*/}}
{{- define "interop.labels" -}}
helm.sh/chart: {{ include "interop.chart" . }}
{{ include "interop.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels — used for matchLabels in Deployments and Services.
*/}}
{{- define "interop.selectorLabels" -}}
app.kubernetes.io/name: {{ include "interop.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Seed-job selector labels (post-install hook).
*/}}
{{- define "interop.seedJob.selectorLabels" -}}
app.kubernetes.io/name: {{ include "interop.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: seed-job
{{- end }}

{{/*
Backend-specific selector labels.
*/}}
{{- define "interop.backend.selectorLabels" -}}
app.kubernetes.io/name: {{ include "interop.name" . }}-backend
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: backend
{{- end }}

{{/*
Frontend-specific selector labels.
*/}}
{{- define "interop.frontend.selectorLabels" -}}
app.kubernetes.io/name: {{ include "interop.name" . }}-frontend
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: frontend
{{- end }}

{{/*
Elasticsearch-specific selector labels.
*/}}
{{- define "interop.elasticsearch.selectorLabels" -}}
app.kubernetes.io/name: {{ include "interop.name" . }}-elasticsearch
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: elasticsearch
{{- end }}

{{/*
ServiceAccount name.
*/}}
{{- define "interop.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "interop.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Name of the Secret holding backend env secrets. When backend.existingSecret is
set the chart does not render its own Secret and every ref points at the external
one; otherwise it points at the chart-managed Secret (backend.envSecret).
*/}}
{{- define "interop.backend.secretName" -}}
{{- .Values.backend.existingSecret | default .Values.backend.envSecret -}}
{{- end }}

{{/*
Backend service name.
*/}}
{{- define "interop.backend.serviceName" -}}
{{- printf "%s-backend" (include "interop.fullname" .) }}
{{- end }}

{{/*
Frontend service name.
*/}}
{{- define "interop.frontend.serviceName" -}}
{{- printf "%s-frontend" (include "interop.fullname" .) }}
{{- end }}

{{/*
Elasticsearch service name.
*/}}
{{- define "interop.elasticsearch.serviceName" -}}
{{- if .Values.elasticsearch.enabled }}
{{- printf "%s-elasticsearch" (include "interop.fullname" .) }}
{{- else }}
{{- .Values.elasticsearch.host }}
{{- end }}
{{- end }}

{{/*
Elasticsearch URL (http://host:port).
*/}}
{{- define "interop.elasticsearch.url" -}}
{{- if .Values.elasticsearch.url -}}
{{- .Values.elasticsearch.url -}}
{{- else -}}
{{- printf "%s://%s:%d" (.Values.elasticsearch.scheme | default "http") (include "interop.elasticsearch.serviceName" .) (int .Values.elasticsearch.port) }}
{{- end -}}
{{- end }}

{{/*
Image pull secrets block.
*/}}
{{- define "interop.imagePullSecrets" -}}
{{- if .Values.global.imagePullSecrets }}
imagePullSecrets:
{{- range .Values.global.imagePullSecrets }}
  - name: {{ . }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Render a container image reference with optional digest pinning.
Usage: {{ include "interop.imageRef" (dict "root" . "image" .Values.image.backend) }}
*/}}
{{- define "interop.imageRef" -}}
{{- $root := .root -}}
{{- $image := .image -}}
{{- $repo := printf "%s%s" (ternary (printf "%s/" $root.Values.global.imageRegistry) "" (ne $root.Values.global.imageRegistry "")) $image.repository -}}
{{- if $image.digest -}}
{{- printf "%s@%s" $repo $image.digest -}}
{{- else -}}
{{- printf "%s:%s" $repo ($image.tag | default $root.Chart.AppVersion) -}}
{{- end -}}
{{- end }}
