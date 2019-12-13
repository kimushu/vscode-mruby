#!/usr/bin/env ruby
MRUBY_GIT = "https://github.com/mruby/mruby.git"
MRUBY_VERSION = ENV["MRUBY_VERSION"]
abort "MRUBY_VERSION required" unless MRUBY_VERSION
EXEEXT = RbConfig::CONFIG["EXEEXT"]

require("fileutils")

HOST_OS = RbConfig::CONFIG["host_os"]
case HOST_OS
when /mswin|msys|mingw/
  MRUBY_PLATFORM = "win32"
  MRUBY_ARCH = ENV["MRUBY_ARCH"]
  abort "MRUBY_ARCH required" unless MRUBY_ARCH
when /darwin|mac os/
  MRUBY_PLATFORM = "darwin"
  MRUBY_ARCH = "x64"
when /linux/
  MRUBY_PLATFORM = "linux"
  MRUBY_ARCH = "x64,ia32"
else
  abort "Unknown platform: #{HOST_OS}"
end

puts "-------- Starting --------"
puts "platform: #{MRUBY_PLATFORM}"
puts "version: #{MRUBY_VERSION}"
STDOUT.flush

def make_tar_path(arch)
  "#{MRUBY_VERSION}/#{MRUBY_PLATFORM}-#{arch}.tar"
end

FileUtils.makedirs(MRUBY_VERSION)
exists = MRUBY_ARCH.split(",").all? {|arch| File.exists?("#{make_tar_path(arch)}.lzma") }
if exists
  puts "skipped (already exists)"
  exit(0)
end

unless Dir.exists?("mruby")
  puts "-------- Cloning repository --------"
  STDOUT.flush
  abort "git clone failed" unless system(*%W[git clone #{MRUBY_GIT} --no-checkout mruby])
end

MRUBY_ARCH.split(",").each do |arch|
  tar_path = make_tar_path(arch)
  next if File.exists?("#{tar_path}.lzma")

  Dir.chdir("mruby") do
    puts "-------- Checking out repository --------"
    STDOUT.flush
    abort "git checkout failed" unless system(*%W[git checkout --force #{MRUBY_VERSION}])
    abort "git clean failed" unless system(*%W[git clean -d -f -q -x])
    puts "-------- Building mruby (#{arch}) --------"
    STDOUT.flush
    cmd = %W[ruby ./minirake]
    if MRUBY_PLATFORM != "win32" && arch == "ia32"
      cmd = %W[env CFLAGS=-m32 LDFLAGS=-m32] + cmd
    end
    abort "build failed" unless system(*cmd)
  end

  Dir.chdir(FileUtils.makedirs("mruby/build/#{MRUBY_PLATFORM}/#{arch}")[0]) do
    puts "-------- Collecting artifacts (#{arch}) --------"
    STDOUT.flush
    {"host" => %w[mirb mrbc mruby], "host-debug" => %w[mrdb]}.each_pair do |dir, names|
      names.each do |name|
        FileUtils.copy("../../#{dir}/bin/#{name}#{EXEEXT}", "./")
        if MRUBY_PLATFORM != "win32"
          abort "strip failed" unless system(*%W[strip #{name}#{EXEEXT}])
        end
      end
    end
  end

  puts "-------- Making archive --------"
  STDOUT.flush
  abort "tar failed" unless system(*%W[tar cf #{tar_path} -C mruby/build #{MRUBY_PLATFORM}])
  STDOUT.flush
  abort "lzma failed" unless system(*%W[lzma -9 #{tar_path}])
end
